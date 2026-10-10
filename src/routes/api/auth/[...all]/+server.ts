// Better Auth API catch-all route.
//
// Every request to /api/auth/* is forwarded to Better Auth's handler
// which manages sign-in, sign-out, session, callback, and other
// auth-related endpoints.

import { svelteKitHandler } from 'better-auth/svelte-kit'
import { building } from '$app/environment'
import { error } from '@sveltejs/kit'
import { create_auth } from '$lib/server/auth'
import type { RequestHandler } from './$types'

const handle: RequestHandler = async (event) => {
	const { DB: db, AUTH_KV: auth_kv } = event.platform!.env
	const auth = create_auth(db, auth_kv)

	const response = await svelteKitHandler({
		event,
		resolve: () => new Response(),
		auth,
		building,
	})

	// Better Auth only claims a request when its origin matches `baseURL` (BETTER_AUTH_URL); when
	// it doesn't, the handler above falls through to the empty `new Response()` — a bare 200 with
	// no body and nothing logged. That is what a sign-in failure looks like when the app is reached
	// through a forwarded port or a different hostname, so turn it into an actionable error
	// instead of a silent no-op.
	if (response.status === 200 && response.body === null && !response.headers.has('content-type')) {
		console.error(
			`Auth request ${event.request.method} ${event.url.pathname} was not handled: origin ${event.url.origin} does not match BETTER_AUTH_URL (${auth.options.baseURL}). Add the origin to TRUSTED_ORIGINS and align BETTER_AUTH_URL.`,
		)
		error(500, 'Auth origin mismatch. The request origin does not match BETTER_AUTH_URL.')
	}

	return response
}

export const GET = handle
export const POST = handle
