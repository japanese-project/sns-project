// Authentication gate. The whole app is for signed-in users only: there are no guest sessions
// and no signed-out views. A request without a session can reach only the sign-in page, the auth
// API that page talks to, and the health check that deployments probe. Everything else is
// rejected before any route runs.
import { json, redirect } from '@sveltejs/kit'

const public_paths = new Set(['/login', '/api/health'])
const public_prefixes = ['/api/auth/']

/** Paths reachable without a session. Anything not listed here requires one (fail closed). */
export function is_public_path(pathname: string): boolean {
	return public_paths.has(pathname) || public_prefixes.some((prefix) => pathname.startsWith(prefix))
}

/**
 * Decides what happens to a request. Returns null to let it proceed (signed in, or a public
 * path). API paths without a session get a 401 JSON response. Page paths throw a redirect to
 * /login, which SvelteKit turns into the right response for both full-page loads and client-side
 * navigations (a plain 302 Response would break the latter).
 */
export function check_access(pathname: string, signed_in: boolean): Response | null {
	if (signed_in || is_public_path(pathname)) return null
	if (pathname.startsWith('/api/')) {
		return json({ message: 'Authentication required' }, { status: 401 })
	}
	redirect(302, '/login')
}

/**
 * For page loads: the signed-in user, or a redirect to /login. The hook already guarantees this;
 * the check is here so loads get a non-null user without assertions, and stay safe on their own.
 */
export function require_session_user(locals: App.Locals) {
	if (!locals.user) redirect(302, '/login')
	return locals.user
}
