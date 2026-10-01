import { redirect } from '@sveltejs/kit'
import { parse_query, search_all } from '$lib/server/services/search'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(302, '/login')
	const raw = url.searchParams.get('q')
	if (raw === null || raw.trim() === '')
		return { user: locals.user, query: '', results: null, error: null }

	try {
		const query = parse_query(raw)
		return {
			user: locals.user,
			query,
			results: await search_all(locals.db, locals.user.id, query),
			error: null,
		}
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Search failed'
		const body = (e as { body?: { message?: string } }).body
		return { user: locals.user, query: raw, results: null, error: body?.message ?? message }
	}
}
