/**
 * Guards the "signed-in users only" rule without any runtime allowlist.
 *
 * Every API handler and page load must refuse a request that has no session, and must do so
 * before it touches the database. This test discovers the routes itself, so a newly added route
 * that forgets its session check fails here instead of silently becoming public.
 *
 * Routes that are open on purpose are excluded from the glob below, and nothing else is:
 *   - api/auth/*   Better Auth endpoints that the sign-in flow calls
 *   - api/health   deployment health probe (no user data)
 *   - login        the sign-in page
 * (The root +layout.server.ts only forwards the session user and is not matched by the glob.)
 */
import { isHttpError, isRedirect } from '@sveltejs/kit'
import { describe, expect, it } from 'vitest'

const modules = import.meta.glob<Record<string, unknown>>(
	[
		'./**/+server.ts',
		'./**/+page.server.ts',
		'!./api/auth/**', // sign-in flow
		'!./api/health/**', // deployment health probe
		'!./login/**', // sign-in page
	],
	{ eager: true },
)

// Page routes that have no server load at all. Nothing but a load can guard a page, so each
// page needs one, except these template demo pages, which show no user data.
const pages_without_load_allowed = new Set([
	'./demo/+page.svelte',
	'./demo/playwright/+page.svelte',
])
const page_files = Object.keys(import.meta.glob(['./**/+page.svelte', '!./login/**']))

const entry_points = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'load']

/** A `db` that fails loudly if anything uses it, to prove the session check comes first. */
const untouchable_db = new Proxy(
	{},
	{
		get() {
			throw new Error('database was used before the session was checked')
		},
	},
)

function event_without_session() {
	const url = new URL('http://localhost/')
	return {
		locals: { db: untouchable_db, user: null, session: null },
		params: new Proxy({}, { get: () => 'x' }),
		url,
		request: new Request(url, { method: 'POST', body: '{}' }),
	}
}

async function outcome(handler: (event: never) => unknown) {
	try {
		await handler(event_without_session() as never)
		return 'ran without rejecting the request'
	} catch (e) {
		if (isHttpError(e)) return `http ${e.status}`
		if (isRedirect(e)) return `redirect ${e.status} ${e.location}`
		return `threw ${e instanceof Error ? e.message : String(e)}`
	}
}

describe('route guards', () => {
	it('finds the routes it is supposed to check', () => {
		// A broken glob would make the sweep below pass vacuously.
		expect(Object.keys(modules).length).toBeGreaterThan(20)
		expect(Object.keys(modules)).toContain('./api/posts/+server.ts')
		expect(Object.keys(modules)).toContain('./explore/+page.server.ts')
	})

	it('rejects a request with no session in every API handler and page load', async () => {
		const results: Record<string, string> = {}
		const expected: Record<string, string> = {}
		for (const [file, mod] of Object.entries(modules)) {
			const is_page_load = file.endsWith('+page.server.ts')
			for (const name of entry_points) {
				const handler = mod[name]
				if (typeof handler !== 'function') continue
				const key = `${file} ${name}`
				results[key] = await outcome(handler as (event: never) => unknown)
				expected[key] = is_page_load ? 'redirect 302 /login' : 'http 401'
			}
		}
		expect(Object.keys(results).length).toBeGreaterThan(30)
		expect(results).toEqual(expected)
	})

	it('has a server load behind every page, so a page cannot be left unguarded', () => {
		const unguarded = page_files.filter((file) => {
			const has_load = `${file.replace('+page.svelte', '+page.server.ts')}` in modules
			return !has_load && !pages_without_load_allowed.has(file)
		})
		expect(unguarded).toEqual([])
	})
})
