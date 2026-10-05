import { RateLimiter } from 'sveltekit-rate-limiter/server'
import type { Rate } from 'sveltekit-rate-limiter/server'
import type { RequestEvent } from '@sveltejs/kit'

// One limit per category. Production enforcement uses the Cloudflare Rate Limiting binding
// (see wrangler.jsonc); this table is the single source of truth for the numbers, since the
// binding fixes a limit per binding and not per request.
const per_minute = (n: number): { IP: Rate; IPUA: Rate } => ({
	IP: [n, 'm'],
	IPUA: [n, 'm'],
})

export const RATE_LIMITS = {
	auth: per_minute(10),
	uploads: per_minute(10),
	reports: per_minute(10),
	posts_write: per_minute(20),
	comments: per_minute(30),
	follows: per_minute(30),
	search: per_minute(30),
	likes: per_minute(60),
	read: per_minute(120),
}

export type RateCategory = keyof typeof RATE_LIMITS

type Limits = typeof RATE_LIMITS

// Returns null for service-to-service endpoints: the deploy pipeline polls /api/health and the
// bot runs on a schedule, so throttling them would break deploys and the bot.
export function rate_limit_for(pathname: string, method: string): RateCategory | null {
	if (pathname.startsWith('/api/health') || pathname.startsWith('/api/internal/')) return null
	if (pathname.startsWith('/api/auth')) return 'auth'
	if (pathname.startsWith('/api/search')) return 'search'
	if (pathname.startsWith('/api/report')) return 'reports'
	if (pathname.startsWith('/api/media') && method === 'POST') return 'uploads'
	if (pathname.endsWith('/comments') || pathname.startsWith('/api/comments')) return 'comments'
	// Saving to favorites is the same kind of cheap toggle as a like, so it shares that budget.
	if ((pathname.endsWith('/like') || pathname.endsWith('/bookmark')) && method !== 'GET')
		return 'likes'
	if (pathname.endsWith('/follow') && method !== 'GET') return 'follows'
	if (pathname.startsWith('/api/posts') && method !== 'GET') return 'posts_write'
	return 'read'
}

/**
 * Builds a limiter over a set of per-category limits. Production uses RATE_LIMITS; tests pass
 * their own small limits so the suite does not scale with the production numbers.
 *
 * When a Cloudflare Rate Limiting binding is bound (see wrangler.jsonc) the budget is counted per
 * colo, shared by every isolate serving it, which is permissive and eventually consistent rather
 * than an exact global counter. That suits abuse dampening; do not meter or bill with it.
 * Otherwise an in-memory limiter runs per category (`RateLimiter` hashes on IP and IP+User-Agent,
 * never the path), whose counters are per-isolate and reset on recycle, so they are not a
 * production limit either.
 */
export function create_rate_limiter(limits: Limits = RATE_LIMITS) {
	const memory_limiters = Object.fromEntries(
		Object.entries(limits).map(([category, rates]) => [category, new RateLimiter(rates)]),
	) as Record<RateCategory, RateLimiter>

	return async function is_rate_limited(
		category: RateCategory,
		event: RequestEvent,
	): Promise<boolean> {
		const env = event.platform?.env as Record<string, RateLimit | undefined> | undefined
		// Categories sharing a limit share one binding; the key prefix keeps them independent.
		const binding = env?.[`RL_${limits[category].IP[0]}`]
		if (!binding) return memory_limiters[category].isLimited(event)

		const { success } = await binding.limit({ key: `${category}:${event.getClientAddress()}` })
		return !success
	}
}

export const is_rate_limited = create_rate_limiter()
