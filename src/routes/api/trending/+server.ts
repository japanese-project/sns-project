import { json } from '@sveltejs/kit'
import { get_trending_topics, parse_trending_period } from '$lib/server/services/posts'
import { require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, url }) => {
	require_user_id(locals)
	const limit_param = url.searchParams.get('limit')
	const limit = limit_param ? Number(limit_param) : 8
	const period = parse_trending_period(url.searchParams.get('period'))
	const topics = await get_trending_topics(locals.db, limit, period)
	return json({ topics })
}
