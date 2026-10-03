import { fail } from '@sveltejs/kit'
import { user } from '$lib/server/db/schema/auth'
import { eq } from 'drizzle-orm'
import { MAX_BIO_LENGTH, MAX_NAME_LENGTH } from '$lib/limits'
import { require_session_user } from '$lib/server/validation'
import type { PageServerLoad, Actions } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent()
	return { user }
}

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const session_user = require_session_user(locals)

		const data = await request.formData()
		const name = data.get('name')?.toString() || ''
		const username = data.get('username')?.toString().toLowerCase() || ''
		const bio = data.get('bio')?.toString() || ''
		// For simplicity, we just handle the core fields here.
		// A full implementation might reuse the `/api/users/me` logic or share a service function.
		
		const trimmed_name = name.trim()
		const trimmed_username = username.trim()
		const trimmed_bio = bio.trim()

		if (!trimmed_name || trimmed_name.length > MAX_NAME_LENGTH) {
			return fail(400, { error: `Name must be between 1 and ${MAX_NAME_LENGTH} characters.` })
		}
		if (trimmed_username && !/^[a-z0-9_]{3,30}$/.test(trimmed_username)) {
			return fail(400, { error: 'Invalid username format.' })
		}
		if (trimmed_bio.length > MAX_BIO_LENGTH) {
			return fail(400, { error: `Bio cannot exceed ${MAX_BIO_LENGTH} characters.` })
		}

		try {
			await locals.db.update(user)
				.set({
					name: trimmed_name,
					username: trimmed_username,
					bio: trimmed_bio.length > 0 ? trimmed_bio : null,
					updatedAt: new Date()
				})
				.where(eq(user.id, session_user.id))
			
			return { success: true }
		} catch (e: unknown) {
			const err = e as Error
			// Catch SQLite unique constraint on username
			if (err.message?.includes('UNIQUE constraint failed: user.username')) {
				return fail(400, { error: 'Username is already taken.' })
			}
			return fail(500, { error: 'Failed to update profile.' })
		}
	},
}
