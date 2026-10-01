import { json } from '@sveltejs/kit'
import { get_users_by_interests } from '$lib/server/services/users'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, url }) => {
	const limit_param = url.searchParams.get('limit')
	const limit = limit_param ? Number(limit_param) : 5
	const interests_param = url.searchParams.get('interests') ?? ''
	const interests = interests_param ? interests_param.split(',').filter(Boolean) : []
	const users = await get_users_by_interests(locals.db, locals.user?.id ?? null, interests, limit)
	return json({ users })
}
