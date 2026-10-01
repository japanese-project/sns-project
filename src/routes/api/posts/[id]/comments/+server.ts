import { json } from '@sveltejs/kit'
import { create_comment, list_comments } from '$lib/server/services/comments'
import { read_json, require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, params }) => {
	return json({ items: await list_comments(locals.db, locals.user?.id ?? null, params.id) })
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user_id = require_user_id(locals)
	const body = await read_json(request)
	return json(await create_comment(locals.db, user_id, params.id, body), { status: 201 })
}
