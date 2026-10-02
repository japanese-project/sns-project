import { json, type RequestHandler } from '@sveltejs/kit'
import { cleanup_orphaned_media } from '$lib/server/services/media'
import { read_optional_json, require_user_id } from '$lib/server/validation'

const default_cleanup_older_than_ms = 24 * 60 * 60 * 1000 // 24 hours safe default

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	const admin_secret =
		(platform?.env as Record<string, unknown> | undefined)?.ADMIN_SECRET ??
		(platform?.env as Record<string, unknown> | undefined)?.CRON_SECRET ??
		process.env.ADMIN_SECRET

	const auth_header = request.headers.get('authorization')
	const admin_header =
		request.headers.get('x-admin-secret') ?? request.headers.get('x-maintenance-key')

	const has_valid_secret = Boolean(
		admin_secret && (auth_header === `Bearer ${admin_secret}` || admin_header === admin_secret),
	)

	const admin_user_ids = (platform?.env as Record<string, unknown> | undefined)?.ADMIN_USER_IDS
	const is_admin_user = Boolean(
		locals.user?.id &&
		typeof admin_user_ids === 'string' &&
		admin_user_ids.split(',').includes(locals.user.id),
	)

	if (!has_valid_secret && !is_admin_user) {
		// If unauthenticated entirely, require_user_id throws 401
		require_user_id(locals)
		// Authenticated regular users are forbidden from maintenance operations
		return json(
			{ error: 'Forbidden: maintenance endpoint restricted to admin or worker' },
			{ status: 403 },
		)
	}

	if (!platform?.env?.MEDIA_BUCKET) {
		return json({ error: 'Media storage is not configured' }, { status: 500 })
	}

	const body = await read_optional_json(request)

	if (
		body.older_than_ms !== undefined &&
		(typeof body.older_than_ms !== 'number' ||
			!Number.isFinite(body.older_than_ms) ||
			body.older_than_ms < 0)
	) {
		return json({ error: 'Invalid older_than_ms: must be a non-negative number' }, { status: 400 })
	}

	const older_than_ms = body.older_than_ms ?? default_cleanup_older_than_ms

	const result = await cleanup_orphaned_media(locals.db, platform.env.MEDIA_BUCKET, older_than_ms)
	return json(result)
}
