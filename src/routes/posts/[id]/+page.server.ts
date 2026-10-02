import { require_session_user } from '$lib/server/validation'
import { get_post_or_404, get_trending_topics } from '$lib/server/services/posts'
import { get_suggested_users } from '$lib/server/services/users'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
	const me = require_session_user(locals)
	const [post, suggested_users, trending_topics] = await Promise.all([
		get_post_or_404(locals.db, me.id, params.id),
		get_suggested_users(locals.db, me.id, 4),
		get_trending_topics(locals.db, 5, 'week'),
	])
	return {
		user: me,
		post,
		suggested_users,
		trending_topics,
	}
}
