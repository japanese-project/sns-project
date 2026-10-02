import { json } from '@sveltejs/kit'
import { follow_user, unfollow_user } from '$lib/server/services/follows'
import { require_user_by_handle } from '$lib/server/services/users'
import { require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const PUT: RequestHandler = async ({ locals, params }) => {
	const user_id = require_user_id(locals)
	const target = await require_user_by_handle(locals.db, params.handle)
	return json(await follow_user(locals.db, user_id, target.id))
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const user_id = require_user_id(locals)
	const target = await require_user_by_handle(locals.db, params.handle)
	return json(await unfollow_user(locals.db, user_id, target.id))
}
