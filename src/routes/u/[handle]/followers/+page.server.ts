import { require_session_user } from '$lib/server/validation'
import { require_user_by_handle, to_user_summary } from '$lib/server/services/users'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
	const me = require_session_user(locals)
	const target = await require_user_by_handle(locals.db, params.handle)
	return { user: me, owner: to_user_summary(target) }
}
