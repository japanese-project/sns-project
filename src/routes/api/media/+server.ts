import { json, error } from '@sveltejs/kit'
import { MAX_MEDIA_SIZE_BYTES } from '$lib/limits'
import { require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

const allowed_mime_types: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif',
}

/**
 * Validates the image magic numbers from the first bytes of the file.
 * Returns the detected MIME type, or null if unrecognized or unsupported.
 */
function detect_image_mime(bytes: Uint8Array): string | null {
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return 'image/jpeg'
	}
	if (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	) {
		return 'image/png'
	}
	if (
		bytes.length >= 6 &&
		bytes[0] === 0x47 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x38 &&
		(bytes[4] === 0x37 || bytes[4] === 0x39) &&
		bytes[5] === 0x61
	) {
		return 'image/gif'
	}
	if (
		bytes.length >= 12 &&
		bytes[0] === 0x52 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x46 &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	) {
		return 'image/webp'
	}
	return null
}

export const POST: RequestHandler = async ({ request, platform, locals }) => {
	const user_id = require_user_id(locals)

	if (!platform?.env?.MEDIA_BUCKET) {
		error(500, 'Media bucket not configured')
	}

	let form_data: FormData
	try {
		form_data = await request.formData()
	} catch {
		error(400, 'Invalid form data')
	}

	const file = form_data.get('image')
	if (!file || typeof file === 'string' || !(file instanceof Blob)) {
		error(400, 'No image file uploaded')
	}

	if (file.size === 0) {
		error(400, 'File cannot be empty')
	}

	if (file.size > MAX_MEDIA_SIZE_BYTES) {
		error(400, `File size exceeds maximum allowed size (${MAX_MEDIA_SIZE_BYTES / (1024 * 1024)}MB)`)
	}

	// Validate declared MIME type
	const declared_type = file.type?.toLowerCase()
	if (!declared_type || !(declared_type in allowed_mime_types)) {
		error(400, 'Invalid file type. Allowed types: JPEG, PNG, WebP, GIF')
	}

	// Validate actual file magic bytes
	const header_bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
	const detected_type = detect_image_mime(header_bytes)
	if (!detected_type || detected_type !== declared_type) {
		error(400, 'Invalid image content or type mismatch')
	}

	const ext = allowed_mime_types[detected_type]
	const key = `${crypto.randomUUID()}.${ext}`

	await platform.env.MEDIA_BUCKET.put(key, file, {
		customMetadata: { userId: user_id },
		httpMetadata: { contentType: detected_type },
	})

	return json({ url: `/api/media/${key}` }, { status: 201 })
}
