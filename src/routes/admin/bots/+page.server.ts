import { dev } from '$app/environment'
import { env } from '$env/dynamic/private'
import { fail, redirect } from '@sveltejs/kit'
import { desc, eq, sql } from 'drizzle-orm'
import { post as post_table, user as user_table } from '$lib/server/db/schema'
import { is_admin_user } from '$lib/server/admin'
import { BOT_PERSONAS } from '$lib/server/bot/personas'
import { get_bot_config, save_bot_config } from '$lib/server/bot/config'
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
		}
	}

	const config = await get_bot_config(platform?.env?.AUTH_KV)

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

	for (const bot of BOT_PERSONAS) {
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

	const personas = BOT_PERSONAS.map((bot) => ({
		id: bot.id,
		name: bot.name,
		username: bot.username,
		bio: bot.bio,
		image: bot.image,
		banner_color: bot.bannerColor,
		interests: bot.interests,
		feeds: bot.feeds,
		total_posts: total_counts[bot.id] ?? 0,
		daily_posts: daily_counts[bot.id] ?? 0,
		last_posted_at: last_post_dates[bot.id],
	}))

	// Recent 15 posts made by bots
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
		.limit(15)

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
