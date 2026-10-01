import { json } from '@sveltejs/kit'
import { mark_read } from '$lib/server/services/notifications'
import { read_optional_json, require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

/** POST { id?: string } - marks one notification, or all of them when `id` is omitted. */
export const POST: RequestHandler = async ({ locals, request }) => {
	const user_id = require_user_id(locals)
	const body = await read_optional_json(request)
	const id = typeof body.id === 'string' ? body.id : undefined
	return json(await mark_read(locals.db, user_id, id))
}
