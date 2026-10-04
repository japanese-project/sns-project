import { json } from '@sveltejs/kit'
import {
	check_preview_rate_limit,
	fetch_link_preview,
	validate_preview_url,
} from '$lib/server/link-preview'
import { require_user_id } from '$lib/server/validation'
import type { RequestHandler } from './$types'

function get_client_id(event: Parameters<RequestHandler>[0]): string {
	// If user is authenticated, use their user ID
	if (event.locals?.user?.id) {
		return `user:${event.locals.user.id}`
	}

	// Cloudflare Connecting IP header or fallback
	const cf_ip = event.request.headers.get('cf-connecting-ip')
	if (cf_ip) {
		return `ip:${cf_ip}`
	}

	const forwarded = event.request.headers.get('x-forwarded-for')
	if (forwarded) {
		const first = forwarded.split(',')[0].trim()
		if (first) return `ip:${first}`
	}

	try {
		const addr = event.getClientAddress()
		if (addr) return `ip:${addr}`
	} catch {
		// getClientAddress may fail in mock environments
	}

	return 'ip:unknown'
}

export const GET: RequestHandler = async (event) => {
	require_user_id(event.locals)

	const target_url = event.url.searchParams.get('url')
	if (!target_url) {
		return json({ error: 'url parameter is required' }, { status: 400 })
	}

	// Validate target URL format and scheme before any external operation
	try {
		validate_preview_url(target_url)
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Invalid URL'
		return json({ error: message }, { status: 400 })
	}

	// Rate limiting: 15 preview requests / minute
	const client_id = get_client_id(event)
	const kv = event.platform?.env?.AUTH_KV
	const rate_check = await check_preview_rate_limit(client_id, kv)
	if (!rate_check.allowed) {
		return json(
			{
				error: 'rate_limited',
				message: 'Too many link preview requests. Please wait a moment.',
				retryAfterSeconds: rate_check.retry_after_seconds,
			},
			{
				status: 429,
				headers: {
					'Retry-After': String(rate_check.retry_after_seconds ?? 60),
				},
			},
		)
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

export const POST: RequestHandler = async (event) => {
	require_user_id(event.locals)

	let body: { url?: string }
	try {
		body = await event.request.json()
	} catch {
		return json({ error: 'Invalid JSON payload' }, { status: 400 })
	}

	const target_url = body.url
	if (!target_url || typeof target_url !== 'string') {
		return json({ error: 'url property is required' }, { status: 400 })
	}

	// Validate target URL format and scheme before any external operation
	try {
		validate_preview_url(target_url)
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Invalid URL'
		return json({ error: message }, { status: 400 })
	}

	// Rate limiting: 15 preview requests / minute
	const client_id = get_client_id(event)
	const kv = event.platform?.env?.AUTH_KV
	const rate_check = await check_preview_rate_limit(client_id, kv)
	if (!rate_check.allowed) {
		return json(
			{
				error: 'rate_limited',
				message: 'Too many link preview requests. Please wait a moment.',
				retryAfterSeconds: rate_check.retry_after_seconds,
			},
			{
				status: 429,
				headers: {
					'Retry-After': String(rate_check.retry_after_seconds ?? 60),
				},
			},
		)
	}

	try {
		const preview = await fetch_link_preview(target_url)
		return json({ preview })
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch link preview'
		return json({ error: message }, { status: 400 })
	}
}
