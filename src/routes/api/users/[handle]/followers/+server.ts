import { json } from '@sveltejs/kit'
import { list_followers } from '$lib/server/services/follows'
import { require_user_by_handle } from '$lib/server/services/users'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const target = await require_user_by_handle(locals.db, params.handle)
	const limit = url.searchParams.get('limit')
	return json(
		await list_followers(locals.db, locals.user?.id ?? null, target.id, {
			cursor: url.searchParams.get('cursor'),
			limit: limit ? Number(limit) : undefined,
		}),
	)
}
