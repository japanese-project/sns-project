import fs from 'node:fs/promises'
import path from 'node:path'

export const mime_extensions: Record<string, string> = {
	'image/jpeg': '.jpg',
	'image/png': '.png',
	'image/webp': '.webp',
	'image/gif': '.gif',
}

export async function save_image(image?: File | null) {
	if (!image || image.size === 0) {
		return null
	}

	const ext = mime_extensions[image.type] ?? '.jpg'
	const file_name = `${crypto.randomUUID()}${ext}`
	const upload_dir = path.resolve('uploads')
	const file_path = path.join(upload_dir, file_name)

	await fs.mkdir(upload_dir, { recursive: true })
	const buffer = Buffer.from(await image.arrayBuffer())
	await fs.writeFile(file_path, buffer)

	return {
		url: `/api/images/${file_name}`,
		file_path,
	}
}

export async function delete_image(file_path: string) {
	await fs.unlink(file_path).catch(() => {})
}
