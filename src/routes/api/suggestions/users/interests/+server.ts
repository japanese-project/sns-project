import { json } from '@sveltejs/kit'
import { MAX_INTEREST_LENGTH, MAX_INTERESTS_COUNT } from '$lib/limits'
import { get_users_by_interests } from '$lib/server/services/users'
import { require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, url }) => {
	const viewer_id = require_user_id(locals)
	const limit_param = url.searchParams.get('limit')
	const limit = limit_param ? Number(limit_param) : undefined
	// Read-only filter, so be lenient: drop empty/oversized values and cap the count rather than 400.
	const interests = (url.searchParams.get('interests') ?? '')
		.split(',')
		.map((interest) => interest.trim())
		.filter((interest) => interest.length > 0 && interest.length <= MAX_INTEREST_LENGTH)
		.slice(0, MAX_INTERESTS_COUNT)
	const users = await get_users_by_interests(locals.db, viewer_id, interests, limit)
	return json({ users })
}
