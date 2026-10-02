import { json, type RequestHandler } from '@sveltejs/kit'
import { get_storage_stats } from '$lib/server/services/media'
import { require_user_id } from '$lib/server/validation'

export const GET: RequestHandler = async ({ locals, platform }) => {
	require_user_id(locals)

	if (!platform?.env?.MEDIA_BUCKET) {
		return json({ error: 'Media storage is not configured' }, { status: 500 })
	}

	const stats = await get_storage_stats(locals.db, platform.env.MEDIA_BUCKET)
	return json(stats)
}
