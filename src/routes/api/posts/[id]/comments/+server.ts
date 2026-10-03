import { error, json } from '@sveltejs/kit'
import { check_comment_abuse } from '$lib/server/comments/abuse-protection'
import { create_comment, list_comments } from '$lib/server/services/comments'
import { get_visible_post } from '$lib/server/services/posts'
import { read_json, require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, params }) => {
	return json({ items: await list_comments(locals.db, require_user_id(locals), params.id) })
}

export const POST: RequestHandler = async ({ locals, params, platform, request }) => {
	const user_id = require_user_id(locals)
	const body = await read_json(request)
	if (!(await get_visible_post(locals.db, user_id, params.id))) error(404, 'Post not found')

	const kv = platform?.env?.AUTH_KV
	if (!kv) error(503, 'Comment service unavailable')

	const check = await check_comment_abuse(kv, user_id, body.content)
	if (!check.allowed) {
		const status =
			check.reason === 'empty_content' || check.reason === 'content_too_long' ? 400 : 429
		return json(
			{ error: check.reason, retryAfterSeconds: check.retryAfterSeconds },
			{
				status,
				headers: check.retryAfterSeconds
					? { 'Retry-After': String(check.retryAfterSeconds) }
					: undefined,
			},
		)
	}

	return json(await create_comment(locals.db, user_id, params.id, body), { status: 201 })
}
