import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { require_user_id } from '$lib/server/validation'

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	require_user_id(locals)

	if (!platform?.env?.MEDIA_BUCKET) {
		error(500, 'Media bucket not configured')
	}

	const form_data = await request.formData()
	const file = form_data.get('image') as File | null
	if (!file) {
		error(400, 'No image file uploaded')
	}

	const ext = file.name.split('.').pop() || 'bin'
	const key = `${crypto.randomUUID()}.${ext}`

	await platform.env.MEDIA_BUCKET.put(key, file, {
		httpMetadata: { contentType: file.type }
	})

	return json({ url: `/api/media/${key}` }, { status: 201 })
}
