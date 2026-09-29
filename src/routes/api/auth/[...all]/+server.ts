// Better Auth API catch-all route.
//
// Every request to /api/auth/* is forwarded to Better Auth's handler
// which manages sign-in, sign-out, session, callback, and other
// auth-related endpoints.

import { svelteKitHandler } from 'better-auth/svelte-kit'
import { building } from '$app/environment'
import { create_auth } from '$lib/server/auth'
import type { RequestHandler } from './$types'

const handle: RequestHandler = async (event) => {
	const { DB: db, AUTH_KV: auth_kv } = event.platform!.env
	const auth = create_auth(db, auth_kv)

	return svelteKitHandler({
		event,
		resolve: () => new Response(),
		auth,
		building,
	})
}

export const GET = handle
export const POST = handle
