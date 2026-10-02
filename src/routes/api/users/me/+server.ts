import { json } from '@sveltejs/kit'
import { update_user_profile } from '$lib/server/services/users'
import { read_json, require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const PATCH: RequestHandler = async ({ locals, request }) => {
	const user_id = require_user_id(locals)
	const body = await read_json(request)
	const updated = await update_user_profile(locals.db, user_id, body)
	return json(updated)
}
