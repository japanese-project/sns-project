import { redirect } from '@sveltejs/kit'
import { require_user_by_handle, to_user_summary } from '$lib/server/services/users'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) redirect(302, '/login')
	const target = await require_user_by_handle(locals.db, params.handle)
	return { user: locals.user, owner: to_user_summary(target) }
}
