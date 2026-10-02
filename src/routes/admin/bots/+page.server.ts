import { dev } from '$app/environment'
import { env } from '$env/dynamic/private'
import { fail, redirect } from '@sveltejs/kit'
import { desc, eq, sql } from 'drizzle-orm'
import { post as post_table, user as user_table } from '$lib/server/db/schema'
import { is_admin_user } from '$lib/server/admin'
import {
	get_bot_config,
	save_bot_config,
	cancel_bot_campaign,
	get_all_active_personas,
	save_custom_persona,
	save_persona_override,
	delete_custom_persona,
} from '$lib/server/bot/config'
import { TRUSTED_FEED_PRESETS } from '$lib/server/bot/rss'
import { run_bot_cycle } from '$lib/server/bot/runner'
import type { Actions, PageServerLoad } from './$types'

function check_admin(
	user: App.Locals['user'],
	platform_env?: Record<string, unknown>,
	cookie_secret?: string | null,
): boolean {
	return is_admin_user(user, platform_env, cookie_secret)
}

export const load: PageServerLoad = async ({ locals, platform, cookies }) => {
	if (!locals.user) {
		throw redirect(302, '/login')
	}

	const cookie_secret = cookies.get('admin_secret')
	const is_admin = check_admin(
		locals.user,
		platform?.env as Record<string, unknown> | undefined,
		cookie_secret,
	)

	if (!is_admin) {
		return {
			is_admin: false,
			user: locals.user,
			config: null,
			personas: [],
			recent_posts: [],
			trusted_presets: TRUSTED_FEED_PRESETS,
		}
	}

	const config = await get_bot_config(platform?.env?.AUTH_KV)

	// Load all active personas (built-in + custom + overrides)
	const active_personas = await get_all_active_personas(platform?.env?.AUTH_KV)

	// Fetch database user entries for all bots to get current names, usernames, and avatars
	const db_users = await locals.db
		.select({
			id: user_table.id,
			name: user_table.name,
			username: user_table.username,
			bio: user_table.bio,
			image: user_table.image,
			bannerColor: user_table.bannerColor,
		})
		.from(user_table)
		.where(sql`instr(${user_table.id}, 'bot_') = 1`)

	const db_user_map = new Map(db_users.map((u) => [u.id, u]))

	// Bot statistics
	const one_day_ago = new Date(Date.now() - 24 * 60 * 60 * 1000)

	const bot_posts = await locals.db
		.select({
			id: post_table.id,
			user_id: post_table.userId,
			created_at: post_table.createdAt,
		})
		.from(post_table)
		.where(sql`instr(${post_table.userId}, 'bot_') = 1`)
		.orderBy(desc(post_table.createdAt))

	const total_counts: Record<string, number> = {}
	const daily_counts: Record<string, number> = {}
	const last_post_dates: Record<string, string | null> = {}

	for (const bot of active_personas) {
		total_counts[bot.id] = 0
		daily_counts[bot.id] = 0
		last_post_dates[bot.id] = null
	}

	for (const p of bot_posts) {
		if (total_counts[p.user_id] !== undefined) {
			total_counts[p.user_id]++
			if (p.created_at.getTime() >= one_day_ago.getTime()) {
				daily_counts[p.user_id]++
			}
			if (!last_post_dates[p.user_id]) {
				last_post_dates[p.user_id] = p.created_at.toISOString()
			}
		}
	}

	const personas = active_personas.map((bot) => {
		const db_u = db_user_map.get(bot.id)
		return {
			id: bot.id,
			name: db_u?.name || bot.name,
			username: db_u?.username || bot.username,
			bio: db_u?.bio ?? bot.bio,
			image: db_u?.image || bot.image,
			banner_color: db_u?.bannerColor || bot.bannerColor,
			interests: bot.interests,
			feeds: bot.feeds,
			tone_prompt: bot.tonePrompt,
			hashtags: bot.hashtags,
			is_custom:
				!bot.id.startsWith('bot_') ||
				![
					'bot_vibe_coder',
					'bot_agent_flow',
					'bot_oss_watcher',
					'bot_ai_dispatch',
					'bot_learn_code',
					'bot_manga_pulse',
					'bot_anime_slate',
					'bot_novel_hub',
					'bot_otaku_takes',
					'bot_shonen_buzz',
					'bot_cinema_scout',
					'bot_stream_guide',
					'bot_meme_vault',
					'bot_daily_giggle',
					'bot_coffee_dial',
					'bot_cafe_stranger',
					'bot_macro_pulse',
					'bot_curious_notes',
					'bot_indie_founder',
					'bot_daily_facts',
				].includes(bot.id),
			total_posts: total_counts[bot.id] ?? 0,
			daily_posts: daily_counts[bot.id] ?? 0,
			last_posted_at: last_post_dates[bot.id],
		}
	})

	// Recent 20 posts made by bots
	const recent_posts = await locals.db
		.select({
			id: post_table.id,
			user_id: post_table.userId,
			content: post_table.content,
			created_at: post_table.createdAt,
			user_name: user_table.name,
			user_username: user_table.username,
			user_image: user_table.image,
		})
		.from(post_table)
		.innerJoin(user_table, eq(post_table.userId, user_table.id))
		.where(sql`instr(${post_table.userId}, 'bot_') = 1`)
		.orderBy(desc(post_table.createdAt))
		.limit(20)

	return {
		is_admin: true,
		user: locals.user,
		config,
		personas,
		recent_posts: recent_posts.map((p) => ({
			id: p.id,
			user_id: p.user_id,
			content: p.content,
			created_at: p.created_at.toISOString(),
			user_name: p.user_name,
			user_username: p.user_username,
			user_image: p.user_image,
		})),
		trusted_presets: TRUSTED_FEED_PRESETS,
	}
}

export const actions: Actions = {
	unlock: async ({ request, cookies, platform }) => {
		const form_data = await request.formData()
		const secret = form_data.get('secret')?.toString().trim()
		const valid_secret =
			platform?.env?.BOT_CRON_SECRET ??
			platform?.env?.ADMIN_SECRET ??
			env.BOT_CRON_SECRET ??
			process.env.BOT_CRON_SECRET ??
			(dev ? 'dev-secret' : null)

		if (secret && valid_secret && secret === valid_secret) {
			cookies.set('admin_secret', secret, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: !dev,
				maxAge: 60 * 60 * 24 * 30, // 30 days
			})
			return { success: true }
		}

		return fail(400, { error: 'Invalid secret key' })
	},

	toggle_status: async ({ request, platform, locals, cookies }) => {
		const cookie_secret = cookies.get('admin_secret')
		if (
			!check_admin(locals.user, platform?.env as Record<string, unknown> | undefined, cookie_secret)
		) {
			return fail(403, { error: 'Forbidden' })
		}

		const form_data = await request.formData()
		const enabled = form_data.get('enabled') === 'true'
		const config = await save_bot_config({ enabled }, platform?.env?.AUTH_KV)
		return { success: true, config }
	},

	set_campaign: async ({ request, platform, locals, cookies }) => {
		const cookie_secret = cookies.get('admin_secret')
		if (
			!check_admin(locals.user, platform?.env as Record<string, unknown> | undefined, cookie_secret)
		) {
			return fail(403, { error: 'Forbidden' })
		}

		const form_data = await request.formData()
		const end_val = form_data.get('campaign_end')?.toString().trim()
		const interval_val = form_data.get('interval_hours')?.toString().trim()
		const parsed_interval = interval_val ? parseInt(interval_val, 10) : 3

		const campaign_end = end_val ? new Date(end_val).toISOString() : null
		const config = await save_bot_config(
			{
				campaign_end,
				interval_hours: Number.isNaN(parsed_interval) ? 3 : parsed_interval,
			},
			platform?.env?.AUTH_KV,
		)
		return { success: true, config }
	},

	cancel_campaign: async ({ platform, locals, cookies }) => {
		const cookie_secret = cookies.get('admin_secret')
		if (
			!check_admin(locals.user, platform?.env as Record<string, unknown> | undefined, cookie_secret)
		) {
			return fail(403, { error: 'Forbidden' })
		}

		const config = await cancel_bot_campaign(platform?.env?.AUTH_KV)
		return {
			success: true,
			config,
			message: 'Schedule limit canceled. Bots will now run continuously on automated schedule.',
		}
	},

	create_bot: async ({ request, platform, locals, cookies }) => {
		const cookie_secret = cookies.get('admin_secret')
		if (
			!check_admin(locals.user, platform?.env as Record<string, unknown> | undefined, cookie_secret)
		) {
			return fail(403, { error: 'Forbidden' })
		}

		const form_data = await request.formData()
		const name = form_data.get('name')?.toString().trim()
		const raw_username = form_data
			.get('username')
			?.toString()
			.trim()
			.toLowerCase()
			.replace(/^@/, '')
		const bio = form_data.get('bio')?.toString().trim() || ''
		const banner_color = form_data.get('banner_color')?.toString().trim() || 'midnight'
		const tone_prompt =
			form_data.get('tone_prompt')?.toString().trim() ||
			`You are ${name}, a friendly user sharing updates and news.`
		const feeds_raw = form_data.get('feeds')?.toString().trim() || ''
		const hashtags_raw = form_data.get('hashtags')?.toString().trim() || ''
		const interests_raw = form_data.get('interests')?.toString().trim() || ''

		if (!name || name.length < 2 || name.length > 50) {
			return fail(400, { error: 'Display name must be between 2 and 50 characters.' })
		}
		if (!raw_username || !/^[a-z0-9_]{2,30}$/.test(raw_username)) {
			return fail(400, {
				error: 'Username must be 2-30 characters (letters, numbers, underscores only).',
			})
		}

		const bot_id = `bot_${raw_username}`

		// Check if username or ID already exists in DB
		const existing = await locals.db
			.select({ id: user_table.id })
			.from(user_table)
			.where(sql`${user_table.username} = ${raw_username} OR ${user_table.id} = ${bot_id}`)
			.limit(1)

		if (existing.length > 0) {
			return fail(400, { error: `Username @${raw_username} is already in use.` })
		}

		const image =
			form_data.get('image')?.toString().trim() ||
			`https://api.dicebear.com/7.x/notionists/svg?seed=${raw_username}`

		const feeds = feeds_raw
			.split(/[\n,]+/)
			.map((s) => s.trim())
			.filter(Boolean)
		const hashtags = hashtags_raw
			.split(/[\n,]+/)
			.map((s) => (s.startsWith('#') ? s.trim() : `#${s.trim()}`))
			.filter((s) => s.length > 1)
		const interests = interests_raw
			.split(/[\n,]+/)
			.map((s) => s.trim().toLowerCase())
			.filter(Boolean)

		const now = new Date()

		// 1. Insert user into D1 database
		await locals.db.insert(user_table).values({
			id: bot_id,
			name,
			username: raw_username,
			email: `${raw_username}@bot.sns.internal`,
			bio,
			image,
			bannerColor: banner_color,
			interests: JSON.stringify(interests.length > 0 ? interests : ['community']),
			onboarded: true,
			emailVerified: false,
			createdAt: now,
			updatedAt: now,
		})

		// 2. Save custom persona to KV
		await save_custom_persona(
			{
				id: bot_id,
				name,
				username: raw_username,
				email: `${raw_username}@bot.sns.internal`,
				bio,
				interests: interests.length > 0 ? interests : ['community'],
				bannerColor: banner_color,
				image,
				topics: interests.length > 0 ? interests : ['general'],
				tonePrompt: tone_prompt,
				feeds: feeds.length > 0 ? feeds : ['https://news.ycombinator.com/rss'],
				hashtags: hashtags.length > 0 ? hashtags : ['#sns'],
			},
			platform?.env?.AUTH_KV,
		)

		return { success: true, message: `Successfully created bot @${raw_username}!` }
	},

	update_bot: async ({ request, platform, locals, cookies }) => {
		const cookie_secret = cookies.get('admin_secret')
		if (
			!check_admin(locals.user, platform?.env as Record<string, unknown> | undefined, cookie_secret)
		) {
			return fail(403, { error: 'Forbidden' })
		}

		const form_data = await request.formData()
		const bot_id = form_data.get('bot_id')?.toString().trim()
		const name = form_data.get('name')?.toString().trim()
		const raw_username = form_data
			.get('username')
			?.toString()
			.trim()
			.toLowerCase()
			.replace(/^@/, '')
		const bio = form_data.get('bio')?.toString().trim() || ''
		const image = form_data.get('image')?.toString().trim()
		const banner_color = form_data.get('banner_color')?.toString().trim() || 'midnight'
		const tone_prompt = form_data.get('tone_prompt')?.toString().trim()
		const feeds_raw = form_data.get('feeds')?.toString().trim()
		const hashtags_raw = form_data.get('hashtags')?.toString().trim()

		if (!bot_id) return fail(400, { error: 'Missing bot_id' })
		if (!name || name.length < 2 || name.length > 50) {
			return fail(400, { error: 'Display name must be between 2 and 50 characters.' })
		}
		if (!raw_username || !/^[a-z0-9_]{2,30}$/.test(raw_username)) {
			return fail(400, {
				error: 'Username must be 2-30 characters (letters, numbers, underscores only).',
			})
		}

		// Check if new username is taken by a different user
		const existing = await locals.db
			.select({ id: user_table.id })
			.from(user_table)
			.where(eq(user_table.username, raw_username))
			.limit(1)

		if (existing.length > 0 && existing[0].id !== bot_id) {
			return fail(400, {
				error: `Username @${raw_username} is already in use by another account.`,
			})
		}

		// 1. Update DB user table
		await locals.db
			.update(user_table)
			.set({
				name,
				username: raw_username,
				bio,
				...(image ? { image } : {}),
				bannerColor: banner_color,
				updatedAt: new Date(),
			})
			.where(eq(user_table.id, bot_id))

		// 2. Save persona overrides in KV
		const override: Record<string, unknown> = {
			name,
			username: raw_username,
			bio,
			bannerColor: banner_color,
		}
		if (image) override.image = image
		if (tone_prompt) override.tonePrompt = tone_prompt
		if (feeds_raw !== undefined) {
			override.feeds = feeds_raw
				.split(/[\n,]+/)
				.map((s) => s.trim())
				.filter(Boolean)
		}
		if (hashtags_raw !== undefined) {
			override.hashtags = hashtags_raw
				.split(/[\n,]+/)
				.map((s) => (s.startsWith('#') ? s.trim() : `#${s.trim()}`))
				.filter((s) => s.length > 1)
		}

		await save_persona_override(bot_id, override, platform?.env?.AUTH_KV)

		return { success: true, message: `Updated bot @${raw_username} successfully!` }
	},

	delete_bot: async ({ request, platform, locals, cookies }) => {
		const cookie_secret = cookies.get('admin_secret')
		if (
			!check_admin(locals.user, platform?.env as Record<string, unknown> | undefined, cookie_secret)
		) {
			return fail(403, { error: 'Forbidden' })
		}

		const form_data = await request.formData()
		const bot_id = form_data.get('bot_id')?.toString().trim()
		if (!bot_id) return fail(400, { error: 'Missing bot_id' })

		await delete_custom_persona(bot_id, platform?.env?.AUTH_KV)
		return { success: true, message: `Removed bot from active pool.` }
	},

	trigger_bot: async ({ request, platform, locals, cookies }) => {
		const cookie_secret = cookies.get('admin_secret')
		if (
			!check_admin(locals.user, platform?.env as Record<string, unknown> | undefined, cookie_secret)
		) {
			return fail(403, { error: 'Forbidden' })
		}

		const form_data = await request.formData()
		const bot_id = form_data.get('bot_id')?.toString().trim() || null

		const llm_env = {
			GROQ_API_KEY: platform?.env?.GROQ_API_KEY ?? env.GROQ_API_KEY ?? process.env.GROQ_API_KEY,
			OPENAI_API_KEY:
				platform?.env?.OPENAI_API_KEY ?? env.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY,
		}

		const result = await run_bot_cycle(locals.db, llm_env, {
			kv: platform?.env?.AUTH_KV,
			target_bot_id: bot_id,
			bypass_limits: true,
		})

		return { success: true, result }
	},

	delete_post: async ({ request, platform, locals, cookies }) => {
		const cookie_secret = cookies.get('admin_secret')
		if (
			!check_admin(locals.user, platform?.env as Record<string, unknown> | undefined, cookie_secret)
		) {
			return fail(403, { error: 'Forbidden' })
		}

		const form_data = await request.formData()
		const post_id = form_data.get('post_id')?.toString().trim()
		if (!post_id) {
			return fail(400, { error: 'Missing post_id' })
		}

		await locals.db.delete(post_table).where(eq(post_table.id, post_id))
		return { success: true, deleted_id: post_id }
	},
}
