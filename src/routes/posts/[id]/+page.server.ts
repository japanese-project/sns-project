import { require_session_user } from '$lib/server/access'
import { get_post_or_404 } from '$lib/server/services/posts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
	const me = require_session_user(locals)
	const post = await get_post_or_404(locals.db, me.id, params.id)
	return {
		user: me,
		post,
	}
}
