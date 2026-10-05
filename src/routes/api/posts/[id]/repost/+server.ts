import { json } from '@sveltejs/kit'
import { repost_post, unrepost_post } from '$lib/server/services/reposts'
import { read_json, require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const user_id = require_user_id(locals)
	// The body is optional: a bare PUT is a plain repost with no caption.
	const has_body = (await request.clone().text()).trim().length > 0
	const body = has_body ? await read_json(request) : {}
	return json(await repost_post(locals.db, user_id, params.id, body))
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
	return json(await unrepost_post(locals.db, require_user_id(locals), params.id))
}
