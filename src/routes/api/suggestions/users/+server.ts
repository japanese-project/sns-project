import { json } from '@sveltejs/kit'
import { get_suggested_users } from '$lib/server/services/users'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, url }) => {
	const limit_param = url.searchParams.get('limit')
	const limit = limit_param ? Number(limit_param) : 5
	const users = await get_suggested_users(locals.db, locals.user?.id ?? null, limit)
	return json({ users })
}
