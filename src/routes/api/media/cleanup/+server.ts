import { json, type RequestHandler } from '@sveltejs/kit'
import { cleanup_orphaned_media } from '$lib/server/services/media'
import { read_optional_json, require_user_id } from '$lib/server/validation'

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	require_user_id(locals)

	if (!platform?.env?.MEDIA_BUCKET) {
		return json({ error: 'Media storage is not configured' }, { status: 500 })
	}

	const body = await read_optional_json(request)
	const older_than_ms = typeof body.older_than_ms === 'number' ? body.older_than_ms : 0

	const result = await cleanup_orphaned_media(locals.db, platform.env.MEDIA_BUCKET, older_than_ms)
	return json(result)
}
