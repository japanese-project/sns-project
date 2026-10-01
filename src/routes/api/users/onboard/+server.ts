import { json } from '@sveltejs/kit'
import { complete_onboarding } from '$lib/server/services/users'
import { read_json, require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ locals, request }) => {
	const user_id = require_user_id(locals)
	const body = await read_json(request)
	const result = await complete_onboarding(locals.db, user_id, body)
	return json(result)
}
