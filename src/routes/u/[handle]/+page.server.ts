import { build_profile } from '$lib/server/services/follows'
import { require_user_by_handle } from '$lib/server/services/users'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
	const viewer_id = locals.user?.id ?? null
	const target = await require_user_by_handle(locals.db, params.handle)
	return {
		user: locals.user ?? null,
		profile: await build_profile(locals.db, viewer_id, target),
	}
}
