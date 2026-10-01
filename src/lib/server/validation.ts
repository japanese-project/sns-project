import { error } from '@sveltejs/kit'

/** Validates user-supplied text: must be a string, non-empty after trimming, and within `max`. */
export function validate_text(raw: unknown, max: number, label: string): string {
	if (typeof raw !== 'string') error(400, `${label} is required`)
	const text = raw.trim()
	if (text.length === 0) error(400, `${label} must not be empty`)
	if (text.length > max) error(400, `${label} must be at most ${max} characters`)
	return text
}

export function require_user_id(locals: App.Locals): string {
	if (!locals.user) error(401, 'Authentication required')
	return locals.user.id
}

export async function read_json(request: Request): Promise<Record<string, unknown>> {
	try {
		const body = await request.json()
		if (body && typeof body === 'object' && !Array.isArray(body)) {
			return body as Record<string, unknown>
		}
	} catch {
		// fall through
	}
	error(400, 'Invalid JSON body')
}

/** Like read_json, but an empty body is treated as `{}`. */
export async function read_optional_json(request: Request): Promise<Record<string, unknown>> {
	const text = await request.text()
	if (text.trim() === '') return {}
	return await read_json(new Request(request.url, { method: 'POST', body: text }))
}
