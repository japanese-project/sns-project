import { json } from '@sveltejs/kit'
import { fetch_link_preview } from '$lib/server/link-preview'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url }) => {
	const target_url = url.searchParams.get('url')
	if (!target_url) {
		return json({ error: 'url parameter is required' }, { status: 400 })
	}

	try {
		const preview = await fetch_link_preview(target_url)
		return json(
			{ preview },
			{
				headers: {
					'Cache-Control': 'public, max-age=3600, s-maxage=86400',
				},
			},
		)
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch link preview'
		return json({ error: message }, { status: 400 })
	}
}

export const POST: RequestHandler = async ({ request }) => {
	let body: { url?: string }
	try {
		body = await request.json()
	} catch {
		return json({ error: 'Invalid JSON payload' }, { status: 400 })
	}

	const target_url = body.url
	if (!target_url || typeof target_url !== 'string') {
		return json({ error: 'url property is required' }, { status: 400 })
	}

	try {
		const preview = await fetch_link_preview(target_url)
		return json({ preview })
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch link preview'
		return json({ error: message }, { status: 400 })
	}
}
