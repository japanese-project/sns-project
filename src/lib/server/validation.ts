import { error, redirect } from '@sveltejs/kit'
import { MAX_INTEREST_LENGTH, MAX_INTERESTS_COUNT } from '$lib/limits'

/** Validates user-supplied text: must be a string, non-empty after trimming, and within `max`. */
export function validate_text(raw: unknown, max: number, label: string): string {
	if (typeof raw !== 'string') error(400, `${label} is required`)
	const text = raw.trim()
	if (text.length === 0) error(400, `${label} must not be empty`)
	if (text.length > max) error(400, `${label} must be at most ${max} characters`)
	return text
}

// Control (Cc), invisible formatting such as zero-width / bidi overrides (Cf), and line or
// paragraph separators (Zl, Zp). None belong in a short, human-readable interest label.
const disallowed_interest_chars = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u

/**
 * Validates an interests array: it must be an array of strings; each value is trimmed and
 * must be non-empty, at most MAX_INTEREST_LENGTH characters and free of control/invisible
 * characters. The total count is capped at MAX_INTERESTS_COUNT (extra values are dropped).
 */
export function validate_interests(raw: unknown): string[] {
	if (!Array.isArray(raw)) error(400, 'Interests must be an array of strings')
	const result: string[] = []
	for (const item of raw) {
		if (typeof item !== 'string') error(400, 'Each interest must be a string')
		const trimmed = item.trim()
		if (trimmed.length === 0) continue
		if (trimmed.length > MAX_INTEREST_LENGTH) {
			error(400, `Each interest must be at most ${MAX_INTEREST_LENGTH} characters`)
		}
		if (disallowed_interest_chars.test(trimmed)) {
			error(400, 'Interest values must not contain control or invisible characters')
		}
		result.push(trimmed)
		if (result.length >= MAX_INTERESTS_COUNT) break
	}
	return result
}

/**
 * Returns true if the error is a SQLite / D1 UNIQUE constraint violation.
 *
 * Drizzle wraps driver errors in a DrizzleQueryError whose own message is only
 * "Failed query: <sql>"; the real "UNIQUE constraint failed: ..." text lives on `.cause`.
 * So the whole cause chain has to be inspected, not just `err.message`.
 */
export function is_unique_constraint_error(err: unknown): boolean {
	for (let current = err, depth = 0; current instanceof Error && depth < 5; depth++) {
		const msg = current.message.toLowerCase()
		if (msg.includes('unique constraint failed') || msg.includes('sqlite_constraint_unique')) {
			return true
		}
		current = current.cause
	}
	return false
}

export function require_user_id(locals: App.Locals): string {
	if (!locals.user) error(401, 'Authentication required')
	return locals.user.id
}

/**
 * Page-load counterpart of require_user_id: the signed-in user, or a redirect to /login.
 * SvelteKit turns the redirect into the right response for full-page loads and for
 * client-side navigations alike.
 */
export function require_session_user(locals: App.Locals) {
	if (!locals.user) redirect(302, '/login')
	return locals.user
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
