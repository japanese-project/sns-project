// SvelteKit server hooks.
//
// Runs on every request. Resolves the current session from Better Auth
// and populates event.locals with user and session data so that
// layouts and pages can access the authenticated user.

import { dev, building } from '$app/environment'
import { create_auth } from '$lib/server/auth'
import { create_db } from '$lib/server/db'
import { user as user_table } from '$lib/server/db/schema'
import { ensure_username } from '$lib/server/services/users'
import { is_admin_user } from '$lib/server/admin'
import { rate_limit_for, is_rate_limited } from '$lib/server/rate-limit'
import { eq } from 'drizzle-orm'
import type { Handle } from '@sveltejs/kit'
import { error } from '@sveltejs/kit'

let platform_proxy: {
	env: App.Platform['env']
} | null = null

if (dev && !building) {
	const { getPlatformProxy: get_platform_proxy } = await import('wrangler')
	platform_proxy = await get_platform_proxy()
}

export const handle: Handle = async ({ event, resolve }) => {
	// Bind the platform env first: rate limiting reads the Cloudflare Rate Limiting bindings from
	// event.platform.env, which is only populated here (and is absent in production, where the
	// platform supplies it directly).
	if (dev && platform_proxy) {
		event.platform = {
			...event.platform,
			env: platform_proxy.env,
		} as App.Platform
	}

	if (event.url.pathname.startsWith('/api/')) {
		const category = rate_limit_for(event.url.pathname, event.request.method)
		if (category && (await is_rate_limited(category, event))) {
			error(429, `API rate limit exceeded for ${category}. Please try again later.`)
		}
	}

	const platform_env = event.platform?.env
	if (!platform_env) {
		// During prerendering or when platform env is unavailable, skip auth.
		event.locals.user = null
		event.locals.session = null
		return resolve(event)
	}

	// Skip auth for healthcheck to avoid dependency on secrets which might not be fully propagated during deployment
	if (event.url.pathname === '/api/health') {
		event.locals.user = null
		event.locals.session = null
		return resolve(event)
	}

	const { DB: db, AUTH_KV: auth_kv } = platform_env
	const auth = create_auth(db, auth_kv)

	const session_data = await auth.api.getSession({
		headers: event.request.headers,
	})

	event.locals.db = create_db(db)
	event.locals.user = session_data?.user ?? null
	event.locals.session = session_data?.session ?? null

	if (event.locals.user) {
		try {
			const db_user = await event.locals.db
				.select({
					username: user_table.username,
					onboarded: user_table.onboarded,
					name: user_table.name,
					bio: user_table.bio,
					interests: user_table.interests,
				})
				.from(user_table)
				.where(eq(user_table.id, event.locals.user.id))
				.get()

			if (db_user) {
				event.locals.user.onboarded = Boolean(db_user.onboarded)
				event.locals.user.name = db_user.name
				event.locals.user.bio = db_user.bio
				event.locals.user.interests = db_user.interests
				if (!db_user.username) {
					event.locals.user.username = await ensure_username(
						event.locals.db,
						event.locals.user.id,
						event.locals.user.email,
					)
				} else {
					event.locals.user.username = db_user.username
				}
			}
		} catch (err) {
			// Best-effort enrichment: a failure shouldn't take the whole page down, but it must
			// not be silent either (e.g. ensure_username propagates unexpected DB errors).
			console.error('Failed to enrich session user from the database', err)
		}

		const cookie_admin_secret = event.cookies.get('admin_secret')
		event.locals.user.isAdmin = is_admin_user(
			event.locals.user,
			event.platform?.env as Record<string, unknown> | undefined,
			cookie_admin_secret,
		)
	}

	return resolve(event)
}
