import { error } from '@sveltejs/kit'
import fs from 'node:fs/promises'
import path from 'node:path'
import { require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, locals }) => {
	require_user_id(locals)

	const safe_name = path.basename(params.filename)
	const file_path = path.resolve('uploads', safe_name)

	try {
		const file = await fs.readFile(file_path)
		return new Response(file, {
			headers: {
				'Cache-Control': 'public, max-age=31536000',
			},
		})
	} catch {
		throw error(404, 'Image not found')
	}
}
