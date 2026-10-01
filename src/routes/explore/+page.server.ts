import { get_trending_topics, list_feed } from '$lib/server/services/posts'
import { parse_query, search_all } from '$lib/server/services/search'
import { get_suggested_users } from '$lib/server/services/users'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, url }) => {
	const viewer_id = locals.user?.id ?? null
	const raw = url.searchParams.get('q')

	if (raw === null || raw.trim() === '') {
		const [suggested_users, discovery_feed, topics] = await Promise.all([
			get_suggested_users(locals.db, viewer_id, 6),
			list_feed(locals.db, viewer_id, { limit: 8 }),
			get_trending_topics(locals.db, 10),
		])

		return {
			user: locals.user ?? null,
			query: '',
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
			user: locals.user ?? null,
			query,
			results: await search_all(locals.db, viewer_id, query),
			discovery: null,
			error: null,
		}
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Search failed'
		const body = (e as { body?: { message?: string } }).body
		return {
			user: locals.user ?? null,
			query: raw,
			results: null,
			discovery: null,
			error: body?.message ?? message,
		}
	}
}
