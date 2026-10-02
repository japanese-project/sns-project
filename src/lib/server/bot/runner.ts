import { desc, gte, sql } from 'drizzle-orm'
import type { Db } from '../db'
import { post as post_table, user as user_table } from '../db/schema'
import { create_post } from '../services/posts'
import { like_post } from '../services/likes'
import { create_comment } from '../services/comments'
import { type BotPersona } from './personas'
import { fetch_feed_items, type FeedItem } from './rss'
import { generate_post_content, generate_bot_comment } from './llm'
import { get_bot_config, get_all_active_personas } from './config'

export interface BotRunOptions {
	kv?: KVNamespace | null
	target_bot_id?: string | null
	bypass_limits?: boolean
}

export interface BotRunResult {
	success: boolean
	message?: string
	posted?: {
		postId: string
		botHandle: string
		title: string
		link: string
	}
	socialActivity?: {
		likesAdded: number
		commentsAdded: number
	}
}

export async function run_bot_cycle(
	db: Db,
	env: { GROQ_API_KEY?: string; OPENAI_API_KEY?: string },
	options?: BotRunOptions,
): Promise<BotRunResult> {
	// 0. Check bot campaign status and configuration
	const config = await get_bot_config(options?.kv)
	if (!config.enabled && !options?.bypass_limits) {
		return {
			success: true,
			message: 'Bot posting is currently paused in admin settings.',
		}
	}

	if (config.campaign_end && !options?.bypass_limits) {
		const end_time = new Date(config.campaign_end).getTime()
		if (!Number.isNaN(end_time) && Date.now() > end_time) {
			return {
				success: true,
				message: `Bot campaign ended on ${config.campaign_end}. Posting has stopped automatically.`,
			}
		}
	}

	// Load all active personas (built-in + custom + overrides)
	const personas = await get_all_active_personas(options?.kv)
	if (personas.length === 0) {
		return {
			success: false,
			message: 'No bot personas available.',
		}
	}

	// Fetch up-to-date user records from DB to ensure custom names/usernames are honored
	const db_users = await db
		.select({
			id: user_table.id,
			name: user_table.name,
			username: user_table.username,
			bio: user_table.bio,
			image: user_table.image,
		})
		.from(user_table)
		.where(sql`instr(${user_table.id}, 'bot_') = 1`)

	const db_user_map = new Map(db_users.map((u) => [u.id, u]))

	// Synchronize persona display names and usernames from DB if available
	const active_personas = personas.map((p) => {
		const db_u = db_user_map.get(p.id)
		if (db_u) {
			return {
				...p,
				name: db_u.name || p.name,
				username: db_u.username || p.username,
				bio: db_u.bio || p.bio,
				image: db_u.image || p.image,
			}
		}
		return p
	})

	const one_day_ago = new Date(Date.now() - 24 * 60 * 60 * 1000)

	// 1. Candidate selection
	let chosen_bot: BotPersona | null = options?.target_bot_id
		? (active_personas.find((b) => b.id === options.target_bot_id) ?? null)
		: null

	if (!chosen_bot) {
		const bot_ids = active_personas.map((b) => b.id)

		// Fetch post counts and most recent post time for each bot in the last 24h
		const recent_posts = await db
			.select({
				userId: post_table.userId,
				createdAt: post_table.createdAt,
			})
			.from(post_table)
			.where(gte(post_table.createdAt, one_day_ago))
			.orderBy(desc(post_table.createdAt))

		const post_counts: Record<string, number> = {}
		const last_posted_times: Record<string, number> = {}

		for (const id of bot_ids) {
			post_counts[id] = 0
			last_posted_times[id] = 0
		}

		for (const p of recent_posts) {
			if (post_counts[p.userId] !== undefined) {
				post_counts[p.userId]++
				if (p.createdAt.getTime() > last_posted_times[p.userId]) {
					last_posted_times[p.userId] = p.createdAt.getTime()
				}
			}
		}

		// Filter candidates: bots with < 3 posts in the last 24 hours (unless bypass_limits is true)
		const candidates = options?.bypass_limits
			? [...active_personas]
			: active_personas.filter((bot) => (post_counts[bot.id] ?? 0) < 3)

		if (candidates.length === 0) {
			return {
				success: true,
				message: 'All bots have reached their daily post limit (max 3/day).',
			}
		}

		// Sort candidates by longest time since last post
		candidates.sort((a, b) => (last_posted_times[a.id] ?? 0) - (last_posted_times[b.id] ?? 0))

		// Shuffle top 3 candidates to avoid predictable order
		const top_pool = candidates.slice(0, Math.min(3, candidates.length))
		chosen_bot = top_pool[Math.floor(Math.random() * top_pool.length)]
	}

	// 2. Fetch fresh items from trusted feeds for chosen bot
	let chosen_item: FeedItem | null = null
	const shuffled_feeds = [...chosen_bot.feeds].sort(() => Math.random() - 0.5)

	for (const feed_url of shuffled_feeds) {
		const items = await fetch_feed_items(feed_url)
		if (items.length === 0) continue

		for (const item of items) {
			// Check if this link has already been posted
			const existing = await db
				.select({ id: post_table.id })
				.from(post_table)
				.where(sql`instr(${post_table.content}, ${item.link}) > 0`)
				.limit(1)

			if (existing.length === 0) {
				chosen_item = item
				break
			}
		}

		if (chosen_item) break
	}

	if (!chosen_item) {
		return {
			success: true,
			message: `No new unposted items found in feeds for @${chosen_bot.username}.`,
		}
	}

	// 3. Generate post content
	const content = await generate_post_content(chosen_bot, chosen_item, env)

	// 4. Insert post using existing create_post service
	const new_post = await create_post(db, chosen_bot.id, {
		content,
		visibility: 'public',
	})

	// 5. Cross-Bot Social Interaction (Simulate organic likes & comments)
	let likes_added = 0
	let comments_added = 0

	const other_bots = active_personas
		.filter((b) => b.id !== chosen_bot.id)
		.sort(() => Math.random() - 0.5)

	// 70% chance to have 1-2 bots like this new post
	if (Math.random() < 0.7 && other_bots.length > 0) {
		const liker_count = Math.min(other_bots.length, Math.floor(Math.random() * 2) + 1)
		const likers = other_bots.slice(0, liker_count)

		for (const liker of likers) {
			try {
				await like_post(db, liker.id, new_post.id)
				likes_added++
			} catch {
				// Ignore duplicate likes
			}
		}
	}

	// 60% chance to have another bot leave an organic comment on this new post
	if (Math.random() < 0.6 && other_bots.length > 0) {
		const commenter = other_bots[0]
		try {
			const comment_text = await generate_bot_comment(commenter, content, env)
			if (comment_text) {
				await create_comment(db, commenter.id, new_post.id, {
					content: comment_text,
				})
				comments_added++
			}
		} catch (err) {
			console.warn('[Bot Runner] Failed to add cross-bot comment:', err)
		}
	}

	// 30% chance to also comment on a recent post from the last 24h
	if (Math.random() < 0.3 && other_bots.length > 1) {
		try {
			const candidate_posts = await db
				.select({
					id: post_table.id,
					userId: post_table.userId,
					content: post_table.content,
				})
				.from(post_table)
				.where(gte(post_table.createdAt, one_day_ago))
				.orderBy(desc(post_table.createdAt))
				.limit(6)

			// Find a post not authored by other_bots[1]
			const target_post = candidate_posts.find(
				(p) => p.id !== new_post.id && p.userId !== other_bots[1].id,
			)

			if (target_post) {
				const commenter = other_bots[1]
				const comment_text = await generate_bot_comment(commenter, target_post.content, env)
				if (comment_text) {
					await create_comment(db, commenter.id, target_post.id, {
						content: comment_text,
					})
					comments_added++
				}
			}
		} catch (err) {
			console.warn('[Bot Runner] Failed to add secondary comment:', err)
		}
	}

	return {
		success: true,
		posted: {
			postId: new_post.id,
			botHandle: chosen_bot.username,
			title: chosen_item.title,
			link: chosen_item.link,
		},
		socialActivity: {
			likesAdded: likes_added,
			commentsAdded: comments_added,
		},
	}
}
