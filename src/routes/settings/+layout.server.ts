import { require_session_user } from '$lib/server/validation'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals }) => {
	const user = require_session_user(locals)
	return { user }
}
