import { redirect } from '@sveltejs/kit'
import { require_session_user } from '$lib/server/validation'
import type { PageServerLoad } from './$types'

// The old placeholder profile lives on at /u/:username.
export const load: PageServerLoad = async ({ locals }) => {
	const me = require_session_user(locals)
	redirect(302, `/u/${me.username ?? me.id}`)
}
