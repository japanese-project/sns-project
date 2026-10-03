import { fail } from '@sveltejs/kit'
import { update_user_profile } from '$lib/server/services/users'
import { is_unique_constraint_error, require_session_user } from '$lib/server/validation'
import type { PageServerLoad, Actions } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const user = require_session_user(locals)
	return { user }
}

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const session_user = require_session_user(locals)

		const data = await request.formData()
		const name = data.get('name')?.toString() || ''
		const username = data.get('username')?.toString().toLowerCase() || ''
		const bio = data.get('bio')?.toString() || ''

		try {
			await update_user_profile(locals.db, session_user.id, {
				name,
				username: username.trim() === '' ? null : username,
				bio: bio.trim() === '' ? null : bio,
			})
			return { success: true }
		} catch (e: unknown) {
			const err = e as Error & { body?: { message?: string } }
			// Check if it's our custom error or a database unique constraint
			if (err.message && err.message.includes('Username is already taken')) {
				return fail(400, { error: 'Username is already taken.' })
			}
			if (is_unique_constraint_error(e)) {
				return fail(400, { error: 'Username is already taken.' })
			}
			const message = err.body?.message || err.message || 'Failed to update profile.'
			return fail(400, { error: message })
		}
	},
}
