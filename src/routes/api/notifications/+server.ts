import { json } from '@sveltejs/kit'
import { list_notifications, unread_count } from '$lib/server/services/notifications'
import { require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, url }) => {
	const user_id = require_user_id(locals)
	const limit = url.searchParams.get('limit')
	const page = await list_notifications(locals.db, user_id, {
		cursor: url.searchParams.get('cursor'),
		limit: limit ? Number(limit) : undefined,
	})
	return json({ ...page, unread_count: await unread_count(locals.db, user_id) })
}
