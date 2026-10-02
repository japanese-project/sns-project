// Reference: https://svelte.dev/docs/kit/remote-functions#form

import * as v from 'valibot'
import fs from 'node:fs/promises'
import path from 'node:path'
import { form, getRequestEvent } from '$app/server'
import { create_db } from '$lib/server/db'
import { post as schema } from '$lib/server/db/schema'

const post = v.object({
	content: v.pipe(v.string(), v.nonEmpty('Content cannot be empty')),
	visibility: v.optional(v.picklist(['public', 'followers-only']), 'public'),
	image: v.optional(
		v.pipe(
			v.file(),
			v.maxSize(5 * 1024 * 1024, 'Image must be under 5MB'),
			v.mimeType(['image/jpeg', 'image/png', 'image/webp', 'image/gif'], 'File must be an image'),
		),
	),
})

export const create_post = form(post, async ({ content, visibility, image }) => {
	const { platform, locals } = getRequestEvent()

	if (!locals.user) {
		throw new Error('User is not authenticated')
	}

	if (!platform?.env) {
		throw new Error('Platform environment is not available')
	}

	let image_url: string | null = null

	if (image && image.size > 0) {
		const ext = path.extname(image.name) || '.jpg'
		const file_name = `${crypto.randomUUID()}${ext}`
		const upload_dir = path.resolve('uploads')

		await fs.mkdir(upload_dir, { recursive: true })

		const buffer = Buffer.from(await image.arrayBuffer())
		await fs.writeFile(path.join(upload_dir, file_name), buffer)

		image_url = `/api/images/${file_name}`
	}

	const db = create_db(platform.env.DB)
	const id = crypto.randomUUID()

	await db.insert(schema).values({
		id,
		userId: locals.user.id,
		content,
		visibility,
		imageUrl: image_url,
	})

	return { success: true, id, image_url }
})
