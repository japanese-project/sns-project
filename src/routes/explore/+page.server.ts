import { require_session_user } from '$lib/server/validation'
import { get_trending_topics, list_feed, parse_trending_period } from '$lib/server/services/posts'
import { parse_query, search_all } from '$lib/server/services/search'
import { get_suggested_users } from '$lib/server/services/users'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, url }) => {
	const me = require_session_user(locals)
	const viewer_id = me.id
	const raw = url.searchParams.get('q')
	const period = parse_trending_period(url.searchParams.get('period'))

	if (raw === null || raw.trim() === '') {
		const [suggested_users, discovery_feed, topics] = await Promise.all([
			get_suggested_users(locals.db, viewer_id, 6),
			list_feed(locals.db, viewer_id, { limit: 8 }),
			get_trending_topics(locals.db, 10, period),
		])

		return {
			user: me,
			query: '',
			period,
			results: null,
			discovery: {
				suggested_users,
				posts: discovery_feed.items,
				topics,
			},
			error: null,
		}
	}

	try {
		const query = parse_query(raw)
		return {
			user: me,
			query,
			period,
			results: await search_all(locals.db, viewer_id, query),
			discovery: null,
			error: null,
		}
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Search failed'
		const body = (e as { body?: { message?: string } }).body
		return {
			user: me,
			query: raw,
			period,
			results: null,
			discovery: null,
			error: body?.message ?? message,
		}
	}
}
