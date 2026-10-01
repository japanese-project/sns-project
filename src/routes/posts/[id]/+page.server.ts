import { get_post_or_404 } from '$lib/server/services/posts'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
	const viewer_id = locals.user?.id ?? null
	const post = await get_post_or_404(locals.db, viewer_id, params.id)
	return {
		user: locals.user ?? null,
		post,
	}
}
