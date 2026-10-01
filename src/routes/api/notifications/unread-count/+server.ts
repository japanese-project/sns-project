import { json } from '@sveltejs/kit'
import { unread_count } from '$lib/server/services/notifications'
import { require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals }) => {
	return json({ unread_count: await unread_count(locals.db, require_user_id(locals)) })
}
