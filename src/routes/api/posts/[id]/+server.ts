import { json } from '@sveltejs/kit'
import { delete_post, get_post_or_404 } from '$lib/server/services/posts'
import { require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, params }) => {
	return json(await get_post_or_404(locals.db, locals.user?.id ?? null, params.id))
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const user_id = require_user_id(locals)
	await delete_post(locals.db, user_id, params.id)
	return new Response(null, { status: 204 })
}
