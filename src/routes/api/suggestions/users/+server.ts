import { json } from '@sveltejs/kit'
import { get_suggested_users } from '$lib/server/services/users'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, url }) => {
	// The service clamps (and treats a non-numeric value as the default), so pass it through.
	const limit_param = url.searchParams.get('limit')
	const limit = limit_param ? Number(limit_param) : undefined
	const users = await get_suggested_users(locals.db, locals.user?.id ?? null, limit)
	return json({ users })
}
