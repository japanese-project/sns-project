import { json } from '@sveltejs/kit'
import { create_post, list_feed } from '$lib/server/services/posts'
import { read_json, require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, url }) => {
	const limit = url.searchParams.get('limit')
	const feed_param = url.searchParams.get('feed')
	const feed = feed_param === 'following' ? 'following' : 'global'
	const page = await list_feed(locals.db, locals.user?.id ?? null, {
		cursor: url.searchParams.get('cursor'),
		limit: limit ? Number(limit) : undefined,
		feed,
	})
	return json(page)
}

export const POST: RequestHandler = async ({ locals, request }) => {
	const user_id = require_user_id(locals)
	const body = await read_json(request)
	const created = await create_post(locals.db, user_id, body)
	return json(created, { status: 201 })
}
