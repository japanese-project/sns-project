// Keyset ("cursor") pagination helpers. A cursor encodes the (timestamp, id) of the
// last row on the previous page. Ordering is always `timestamp DESC, id DESC`, which is
// stable even when rows share a timestamp or new rows are inserted while paging.
import { error } from '@sveltejs/kit'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '$lib/limits'

export interface Cursor {
	date: Date
	id: string
}

export function encode_cursor(date: Date, id: string): string {
	return btoa(`${Math.floor(date.getTime() / 1000)}:${id}`)
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '')
}

export function decode_cursor(raw: string | null | undefined): Cursor | null {
	if (!raw) return null
	try {
		const padded = raw.replace(/-/g, '+').replace(/_/g, '/')
		const decoded = atob(padded)
		const separator = decoded.indexOf(':')
		const seconds = Number(decoded.slice(0, separator))
		const id = decoded.slice(separator + 1)
		if (separator < 1 || !Number.isInteger(seconds) || id.length === 0) throw new Error('bad')
		return { date: new Date(seconds * 1000), id }
	} catch {
		error(400, 'Invalid cursor')
	}
}

export function clamp_limit(limit: number | undefined): number {
	if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_PAGE_SIZE
	return Math.min(Math.max(Math.floor(limit), 1), MAX_PAGE_SIZE)
}

/** Escapes LIKE wildcards so user input is matched literally (use with `ESCAPE '\'`). */
export function like_pattern(text: string): string {
	return `%${text.toLowerCase().replace(/[\\%_]/g, (char) => `\\${char}`)}%`
}

/**
 * Time-sortable unique id (millisecond prefix + UUID). Timestamps are stored with one-second
 * resolution, so the id is the tie-breaker for rows created within the same second; a
 * time-ordered id keeps "newest first" chronological instead of random.
 */
export function new_id(): string {
	return `${Date.now().toString(36).padStart(9, '0')}-${crypto.randomUUID()}`
}
