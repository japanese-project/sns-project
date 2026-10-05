import { json } from '@sveltejs/kit'
import { list_bookmarked_posts } from '$lib/server/services/posts'
import { require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

// Always the signed-in user's own collection; nobody can list another user's bookmarks.
export const GET: RequestHandler = async ({ locals, url }) => {
	const limit = url.searchParams.get('limit')
	return json(
		await list_bookmarked_posts(locals.db, require_user_id(locals), {
			cursor: url.searchParams.get('cursor'),
			limit: limit ? Number(limit) : undefined,
		}),
	)
}
