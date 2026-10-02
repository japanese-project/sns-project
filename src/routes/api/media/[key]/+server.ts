import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env?.MEDIA_BUCKET) {
		error(500, 'Media bucket not configured')
	}

	const key = params.key
	const object = await platform.env.MEDIA_BUCKET.get(key)

	if (!object) {
		error(404, 'Not found')
	}

	const headers = new Headers()
	object.writeHttpMetadata(headers)
	headers.set('etag', object.httpEtag)

	return new Response(object.body as ReadableStream, { headers })
}
