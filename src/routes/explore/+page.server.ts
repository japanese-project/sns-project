import { parse_query, search_all } from '$lib/server/services/search'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, url }) => {
	const viewer_id = locals.user?.id ?? null
	const raw = url.searchParams.get('q')
	if (raw === null || raw.trim() === '')
		return { user: locals.user ?? null, query: '', results: null, error: null }

	try {
		const query = parse_query(raw)
		return {
			user: locals.user ?? null,
			query,
			results: await search_all(locals.db, viewer_id, query),
			error: null,
		}
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Search failed'
		const body = (e as { body?: { message?: string } }).body
		return { user: locals.user ?? null, query: raw, results: null, error: body?.message ?? message }
	}
}
