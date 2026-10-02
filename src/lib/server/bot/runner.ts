import { desc, gte, sql } from 'drizzle-orm'
import type { Db } from '../db'
import { post as post_table } from '../db/schema'
import { create_post } from '../services/posts'
import { like_post } from '../services/likes'
import { BOT_PERSONAS } from './personas'
import { fetch_feed_items, type FeedItem } from './rss'
import { generate_post_content } from './llm'
import { get_bot_config } from './config'

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

	const one_day_ago = new Date(Date.now() - 24 * 60 * 60 * 1000)

	// 1. Candidate selection
	let chosen_bot = options?.target_bot_id
		? BOT_PERSONAS.find((b) => b.id === options.target_bot_id)
		: null

	if (!chosen_bot) {
		const bot_ids = BOT_PERSONAS.map((b) => b.id)

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
			? [...BOT_PERSONAS]
			: [...BOT_PERSONAS].filter((bot) => (post_counts[bot.id] ?? 0) < 3)

		if (candidates.length === 0) {
			return {
				success: true,
				message: 'All bots have reached their daily post limit (max 3/day).',
			}
		}

		// Sort candidates by longest time since last post (or random among zero-post bots)
		candidates.sort((a, b) => (last_posted_times[a.id] ?? 0) - (last_posted_times[b.id] ?? 0))

		// Shuffle top 3 candidates to avoid predictable alphabetical/order bias
		const top_pool = candidates.slice(0, Math.min(3, candidates.length))
		chosen_bot = top_pool[Math.floor(Math.random() * top_pool.length)]
	}

	// 2. Fetch feeds for chosen bot
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

	// 5. Cross-Bot Social Interaction (Simulate organic likes)
	let likes_added = 0
	// 60% chance to have 1-3 other bots like this new post or recent bot posts
	if (Math.random() < 0.6) {
		const other_bots = BOT_PERSONAS.filter((b) => b.id !== chosen_bot.id).sort(
			() => Math.random() - 0.5,
		)

		const liker_count = Math.floor(Math.random() * 2) + 1 // 1 to 2 likers
		const likers = other_bots.slice(0, liker_count)

		for (const liker of likers) {
			try {
				await like_post(db, liker.id, new_post.id)
				likes_added++
			} catch {
				// Ignore like errors (e.g. unique constraint)
			}
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
		},
	}
}
