import { redirect } from '@sveltejs/kit'
import { build_profile } from '$lib/server/services/follows'
import { require_user_by_handle } from '$lib/server/services/users'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) redirect(302, '/login')
	const target = await require_user_by_handle(locals.db, params.handle)
	return {
		user: locals.user,
		profile: await build_profile(locals.db, locals.user.id, target),
	}
}
