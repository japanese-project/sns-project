import { redirect } from '@sveltejs/kit'
import { require_session_user } from '$lib/server/validation'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = ({ locals }) => {
	require_session_user(locals)
	redirect(302, '/settings/privacy')
}
