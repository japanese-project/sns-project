import { get_trending_topics } from '$lib/server/services/posts'
import { get_suggested_users } from '$lib/server/services/users'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals }) => {
	const viewer_id = locals.user?.id ?? null
	const [suggested_users, trending_topics] = await Promise.all([
		get_suggested_users(locals.db, viewer_id, 4),
		get_trending_topics(locals.db, 5),
	])

	return {
		user: locals.user,
		session: locals.session,
		suggested_users,
		trending_topics,
	}
}
