import { json } from '@sveltejs/kit'
import { delete_post, get_post_or_404, update_post } from '$lib/server/services/posts'
import { read_json, require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, params }) => {
	return json(await get_post_or_404(locals.db, require_user_id(locals), params.id))
}

export const PATCH: RequestHandler = async ({ locals, params, request, platform }) => {
	const user_id = require_user_id(locals)
	const body = await read_json(request)
	return json(await update_post(locals.db, user_id, params.id, body, platform?.env?.MEDIA_BUCKET))
}

export const DELETE: RequestHandler = async ({ locals, params, platform }) => {
	const user_id = require_user_id(locals)
	await delete_post(locals.db, user_id, params.id, platform?.env?.MEDIA_BUCKET)
	return new Response(null, { status: 204 })
}
