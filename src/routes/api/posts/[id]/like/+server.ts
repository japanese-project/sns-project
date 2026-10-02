import { json } from '@sveltejs/kit'
import { like_post, unlike_post } from '$lib/server/services/likes'
import { require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const PUT: RequestHandler = async ({ locals, params }) => {
	return json(await like_post(locals.db, require_user_id(locals), params.id))
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
	return json(await unlike_post(locals.db, require_user_id(locals), params.id))
}
