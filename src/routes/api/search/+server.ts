import { json } from '@sveltejs/kit'
import { parse_query, search_all } from '$lib/server/services/search'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, url }) => {
	const query = parse_query(url.searchParams.get('q'))
	const limit = url.searchParams.get('limit')
	return json(
		await search_all(locals.db, locals.user?.id ?? null, query, {
			cursor: url.searchParams.get('cursor'),
			limit: limit ? Number(limit) : undefined,
		}),
	)
}
