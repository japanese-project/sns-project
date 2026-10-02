import { require_session_user } from '$lib/server/validation'
import { build_profile } from '$lib/server/services/follows'
import { require_user_by_handle } from '$lib/server/services/users'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
	const me = require_session_user(locals)
	const target = await require_user_by_handle(locals.db, params.handle)
	return {
		user: me,
		profile: await build_profile(locals.db, me.id, target),
	}
}
