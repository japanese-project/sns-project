import * as v from 'valibot'
import { error } from '@sveltejs/kit'
import { form, getRequestEvent } from '$app/server'
import { create_db } from '$lib/server/db'
import { post as schema } from '$lib/server/db/schema'
import { delete_image, mime_extensions, save_image } from '$lib/server/storage'

const post = v.object({
	content: v.pipe(v.string(), v.nonEmpty('Content cannot be empty')),
	visibility: v.optional(v.picklist(['public', 'followers-only']), 'public'),
	image: v.optional(
		v.pipe(
			v.file(),
			v.maxSize(5 * 1024 * 1024, 'Image must be under 5MB'),
			v.check(
				(file) => file.size === 0 || Boolean(mime_extensions[file.type]),
				'File must be a JPEG, PNG, WebP, or GIF image',
			),
		),
	),
})

export const create_post = form(post, async ({ content, visibility, image }) => {
	const { platform, locals } = getRequestEvent()

	if (!locals.user) {
		throw error(401, 'User is not authenticated')
	}

	if (!platform?.env?.DB) {
		throw error(500, 'Database binding is not available')
	}

	const saved_image = await save_image(image)

	try {
		const db = create_db(platform.env.DB)
		const id = crypto.randomUUID()

		await db.insert(schema).values({
			id,
			userId: locals.user.id,
			content,
			visibility,
			imageUrl: saved_image?.url ?? null,
		})

		return { success: true, id, image_url: saved_image?.url ?? null }
	} catch (err) {
		if (saved_image) {
			await delete_image(saved_image.file_path)
		}
		throw err
	}
})
