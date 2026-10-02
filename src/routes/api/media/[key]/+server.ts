import { error } from '@sveltejs/kit'
import { and, eq, or, sql } from 'drizzle-orm'
import { post } from '$lib/server/db/schema'
import { visible_to } from '$lib/server/services/posts'
import { require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, locals, platform }) => {
	const viewer_id = require_user_id(locals)

	if (!platform?.env?.MEDIA_BUCKET) {
		error(500, 'Media bucket not configured')
	}

	const key = params.key
	if (!key || !/^[a-zA-Z0-9_-]+\.[a-z0-9]+$/.test(key)) {
		error(404, 'Not found')
	}

	// Media access follows post visibility rules:
	// The media is only accessible if there is an associated post visible to the viewer.
	const image_url = `/api/media/${key}`
	const query_prefix = `/api/media/${key}?`
	const rows = await locals.db
		.select({ id: post.id })
		.from(post)
		.where(
			and(
				or(eq(post.imageUrl, image_url), sql`instr(${post.imageUrl}, ${query_prefix}) = 1`),
				visible_to(viewer_id),
			),
		)
		.limit(1)

	if (rows.length === 0) {
		error(404, 'Not found')
	}

	const object = await platform.env.MEDIA_BUCKET.get(key)
	if (!object) {
		error(404, 'Not found')
	}

	const headers = new Headers()
	object.writeHttpMetadata(headers)
	headers.set('etag', object.httpEtag)
	headers.set('cache-control', 'private, max-age=3600')

	return new Response(object.body as ReadableStream, { headers })
}
