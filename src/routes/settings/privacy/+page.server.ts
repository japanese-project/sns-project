import { get_user_settings, update_user_settings } from '$lib/server/services/user-settings'
import { require_session_user } from '$lib/server/validation'
import type { PageServerLoad, Actions } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const user = require_session_user(locals)
	const settings = await get_user_settings(locals.db, user.id)
	return { settings }
}

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const user = require_session_user(locals)

		const data = await request.formData()
		const is_private = data.get('is_private') === 'on'
		const notify_on_follow = data.get('notify_on_follow') === 'on'
		const notify_on_like = data.get('notify_on_like') === 'on'
		const notify_on_comment = data.get('notify_on_comment') === 'on'

		await update_user_settings(locals.db, user.id, {
			isPrivate: is_private,
			notifyOnFollow: notify_on_follow,
			notifyOnLike: notify_on_like,
			notifyOnComment: notify_on_comment,
		})

		return { success: true }
	},
}
