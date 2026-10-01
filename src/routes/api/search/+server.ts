import { json } from '@sveltejs/kit'
import { parse_query, search_all } from '$lib/server/services/search'
import { require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, url }) => {
	const viewer_id = require_user_id(locals)
	const query = parse_query(url.searchParams.get('q'))
	const limit = url.searchParams.get('limit')
	return json(
		await search_all(locals.db, viewer_id, query, {
			cursor: url.searchParams.get('cursor'),
			limit: limit ? Number(limit) : undefined,
		}),
	)
}
