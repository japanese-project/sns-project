import { json } from '@sveltejs/kit'
import { delete_comment, update_comment } from '$lib/server/services/comments'
import { read_json, require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const user_id = require_user_id(locals)
	const body = await read_json(request)
	return json(await update_comment(locals.db, user_id, params.id, body))
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const user_id = require_user_id(locals)
	await delete_comment(locals.db, user_id, params.id)
	return new Response(null, { status: 204 })
}
