import { isRedirect } from '@sveltejs/kit'
import { describe, expect, it } from 'vitest'
import { check_access, is_public_path, require_session_user } from './access'

/** Runs check_access the way the hook does and normalises the three possible outcomes. */
async function outcome(pathname: string, signed_in: boolean) {
	try {
		const res = check_access(pathname, signed_in)
		if (res === null) return { kind: 'allowed' as const }
		return { kind: 'response' as const, status: res.status, body: await res.json() }
	} catch (e) {
		if (isRedirect(e)) return { kind: 'redirect' as const, status: e.status, location: e.location }
		throw e
	}
}

describe('check_access: no session', () => {
	it('lets the sign-in page, the auth API and the health check through', async () => {
		for (const path of [
			'/login',
			'/api/health',
			'/api/auth/get-session',
			'/api/auth/sign-in/social',
			'/api/auth/callback/google',
		]) {
			expect({ path, ...(await outcome(path, false)) }).toEqual({ path, kind: 'allowed' })
		}
	})

	it('redirects every page to /login', async () => {
		for (const path of [
			'/',
			'/explore',
			'/notifications',
			'/profile',
			'/u/alice',
			'/u/alice/followers',
			'/u/alice/following',
			'/posts/abc',
			'/demo',
		]) {
			expect({ path, ...(await outcome(path, false)) }).toEqual({
				path,
				kind: 'redirect',
				status: 302,
				location: '/login',
			})
		}
	})

	it('answers every other API path with a JSON 401 (not a redirect)', async () => {
		for (const path of [
			'/api/posts',
			'/api/posts/abc/like',
			'/api/comments/abc',
			'/api/search',
			'/api/trending',
			'/api/suggestions/users',
			'/api/users/me',
			'/api/users/alice/followers',
			'/api/notifications',
			'/api/notifications/unread-count',
		]) {
			expect({ path, ...(await outcome(path, false)) }).toEqual({
				path,
				kind: 'response',
				status: 401,
				body: { message: 'Authentication required' },
			})
		}
	})

	it('fails closed for near-miss paths instead of treating them as public', async () => {
		for (const path of [
			'/login/', // trailing slash: SvelteKit would redirect it, but never trust it here
			'/Login',
			'/loginx',
			'/api/auth', // only paths below /api/auth/ are public
			'/api/authx/anything',
			'/api/health/',
			'/api/healthz',
			'/api/health/details',
			'//login',
		]) {
			const result = await outcome(path, false)
			expect({ path, public: result.kind === 'allowed' }).toEqual({ path, public: false })
		}
	})

	// event.url.pathname comes from `new URL()`, which resolves dot-segments (encoded ones too)
	// before the hook runs, so a public-looking prefix can't be used to reach a private path.
	it('is not fooled by dot-segments, because the URL parser resolves them first', async () => {
		for (const raw of [
			'http://app.test/api/auth/../posts',
			'http://app.test/api/auth/%2e%2e/posts',
			'http://app.test/api/auth/%2E%2E/posts',
			'http://app.test/login/../notifications',
			'http://app.test/api/health/../search',
		]) {
			const { pathname } = new URL(raw)
			const result = await outcome(pathname, false)
			expect({ raw, pathname, public: result.kind === 'allowed' }).toEqual({
				raw,
				pathname,
				public: false,
			})
		}
	})
})

describe('check_access: signed in', () => {
	it('never blocks a signed-in request', async () => {
		for (const path of ['/', '/explore', '/api/posts', '/api/users/me', '/login', '/anything']) {
			expect({ path, ...(await outcome(path, true)) }).toEqual({ path, kind: 'allowed' })
		}
	})
})

describe('is_public_path', () => {
	it('is an exact allowlist', () => {
		expect(is_public_path('/login')).toBe(true)
		expect(is_public_path('/api/health')).toBe(true)
		expect(is_public_path('/api/auth/anything/at/all')).toBe(true)
		expect(is_public_path('/')).toBe(false)
		expect(is_public_path('/api/posts')).toBe(false)
	})
})

describe('require_session_user', () => {
	it('returns the signed-in user', () => {
		const locals = { user: { id: 'u1', name: 'Ann' } } as unknown as App.Locals
		expect(require_session_user(locals).id).toBe('u1')
	})

	it('redirects to /login when there is no session', () => {
		const locals = { user: null } as unknown as App.Locals
		try {
			require_session_user(locals)
			expect.unreachable('should have redirected')
		} catch (e) {
			expect(isRedirect(e)).toBe(true)
			if (isRedirect(e)) expect([e.status, e.location]).toEqual([302, '/login'])
		}
	})
})
