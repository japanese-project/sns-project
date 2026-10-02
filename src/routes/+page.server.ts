import { require_session_user } from '$lib/server/validation'
import { get_trending_topics } from '$lib/server/services/posts'
import { get_suggested_users } from '$lib/server/services/users'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const me = require_session_user(locals)
	const [suggested_users, trending_topics] = await Promise.all([
		get_suggested_users(locals.db, me.id, 4),
		get_trending_topics(locals.db, 5, 'week'),
	])
	return {
		user: me,
		suggested_users,
		trending_topics,
	}
}
