// SvelteKit server hooks.
//
// Runs on every request. Resolves the current session from Better Auth
// and populates event.locals with user and session data so that
// layouts and pages can access the authenticated user.

import { dev, building } from '$app/environment'
import { create_auth } from '$lib/server/auth'
import type { Handle } from '@sveltejs/kit'

let platform_proxy: {
	env: App.Platform['env']
} | null = null

if (dev && !building) {
	const { getPlatformProxy: get_platform_proxy } = await import('wrangler')
	platform_proxy = await get_platform_proxy()
}

export const handle: Handle = async ({ event, resolve }) => {
	if (dev && platform_proxy) {
		event.platform = {
			...event.platform,
			env: platform_proxy.env,
		} as App.Platform
	}

	const platform_env = event.platform?.env
	if (!platform_env) {
		// During prerendering or when platform env is unavailable, skip auth.
		return resolve(event)
	}

	const { DB: db, AUTH_KV: auth_kv } = platform_env
	const auth = create_auth(db, auth_kv)

	const session_data = await auth.api.getSession({
		headers: event.request.headers,
	})

	event.locals.user = session_data?.user ?? null
	event.locals.session = session_data?.session ?? null

	return resolve(event)
}
