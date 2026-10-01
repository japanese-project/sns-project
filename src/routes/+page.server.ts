import { get_suggested_users } from '$lib/server/services/users'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const viewer_id = locals.user?.id ?? null
	const suggested_users = await get_suggested_users(locals.db, viewer_id, 4)
	return {
		user: locals.user ?? null,
		suggested_users,
	}
}
