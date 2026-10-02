import { json } from '@sveltejs/kit'
import { get_suggested_users } from '$lib/server/services/users'
import { require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, url }) => {
	const viewer_id = require_user_id(locals)
	// The service clamps (and treats a non-numeric value as the default), so pass it through.
	const limit_param = url.searchParams.get('limit')
	const limit = limit_param ? Number(limit_param) : undefined
	const users = await get_suggested_users(locals.db, viewer_id, limit)
	return json({ users })
}
