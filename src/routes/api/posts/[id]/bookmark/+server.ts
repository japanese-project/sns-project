import { json } from '@sveltejs/kit'
import { bookmark_post, unbookmark_post } from '$lib/server/services/bookmarks'
import { require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const PUT: RequestHandler = async ({ locals, params }) => {
	return json(await bookmark_post(locals.db, require_user_id(locals), params.id))
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
	return json(await unbookmark_post(locals.db, require_user_id(locals), params.id))
}
