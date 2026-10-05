import { json } from '@sveltejs/kit'
import { repost_post, unrepost_post } from '$lib/server/services/reposts'
import { require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const PUT: RequestHandler = async ({ locals, params }) => {
	return json(await repost_post(locals.db, require_user_id(locals), params.id))
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
	return json(await unrepost_post(locals.db, require_user_id(locals), params.id))
}
