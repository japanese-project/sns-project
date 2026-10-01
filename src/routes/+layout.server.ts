import type { LayoutServerLoad } from './$types'

// Pages load the data they show (trending, suggestions, ...) themselves. The layout only forwards
// the session user, which is null solely on /login, the one page reachable without a session.
export const load: LayoutServerLoad = ({ locals }) => {
	return { user: locals.user, session: locals.session }
}
