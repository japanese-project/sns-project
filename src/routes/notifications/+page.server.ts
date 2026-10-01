import { require_session_user } from '$lib/server/access'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	return { user: require_session_user(locals) }
}
