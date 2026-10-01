import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

// The old placeholder profile lives on at /u/:username.
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login')
	redirect(302, `/u/${locals.user.username ?? locals.user.id}`)
}
