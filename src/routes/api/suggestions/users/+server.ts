import { json } from '@sveltejs/kit'
import { get_suggested_users } from '$lib/server/services/users'
import { MAX_SUGGESTION_LIMIT } from '$lib/limits'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, url }) => {
	const limit_param = url.searchParams.get('limit')
	const limit = limit_param
		? Math.min(Math.max(Math.floor(Number(limit_param)), 1), MAX_SUGGESTION_LIMIT)
		: 5
	const users = await get_suggested_users(locals.db, locals.user?.id ?? null, limit)
	return json({ users })
}
