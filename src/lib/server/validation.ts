import { error } from '@sveltejs/kit'
import { MAX_INTEREST_LENGTH, MAX_INTERESTS_COUNT } from '$lib/limits'

/** Validates user-supplied text: must be a string, non-empty after trimming, and within `max`. */
export function validate_text(raw: unknown, max: number, label: string): string {
	if (typeof raw !== 'string') error(400, `${label} is required`)
	const text = raw.trim()
	if (text.length === 0) error(400, `${label} must not be empty`)
	if (text.length > max) error(400, `${label} must be at most ${max} characters`)
	return text
}

/**
 * Validates an interests array: filters to strings, trims each value, rejects
 * empty or overly long entries, and caps the total count.
 */
export function validate_interests(raw: unknown[]): string[] {
	const result: string[] = []
	for (const item of raw) {
		if (typeof item !== 'string') continue
		const trimmed = item.trim()
		if (trimmed.length === 0) continue
		if (trimmed.length > MAX_INTEREST_LENGTH) {
			error(400, `Each interest must be at most ${MAX_INTEREST_LENGTH} characters`)
		}
		// Reject control characters and other non-printable content
		let has_control_chars = false
		for (let i = 0; i < trimmed.length; i++) {
			const code = trimmed.charCodeAt(i)
			if (code < 32 || code === 127) {
				has_control_chars = true
				break
			}
		}
		if (has_control_chars) {
			error(400, 'Interest values must not contain control characters')
		}
		result.push(trimmed)
		if (result.length >= MAX_INTERESTS_COUNT) break
	}
	return result
}

/**
 * Returns true if the error is a UNIQUE constraint violation (SQLite / D1).
 * Works with both native D1 errors and drizzle-wrapped errors.
 */
export function is_unique_constraint_error(err: unknown): boolean {
	if (!(err instanceof Error)) return false
	const msg = err.message.toLowerCase()
	return msg.includes('unique') || msg.includes('duplicate')
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
