import { RateLimiter } from 'sveltekit-rate-limiter/server'
import type { Rate } from 'sveltekit-rate-limiter/server'

// One limiter per category, because `RateLimiter` hashes only on IP and IP+User-Agent and
// never on the path: a shared instance would put every endpoint in the same bucket.
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

// Returns null for service-to-service endpoints: the deploy pipeline polls /api/health and the
// bot runs on a schedule, so throttling them would break deploys and the bot.
export function rate_limit_for(pathname: string, method: string): RateCategory | null {
	if (pathname.startsWith('/api/health') || pathname.startsWith('/api/internal/')) return null
	if (pathname.startsWith('/api/auth')) return 'auth'
	if (pathname.startsWith('/api/search')) return 'search'
	if (pathname.startsWith('/api/report')) return 'reports'
	if (pathname.startsWith('/api/media') && method === 'POST') return 'uploads'
	if (pathname.endsWith('/comments') || pathname.startsWith('/api/comments')) return 'comments'
	if (pathname.endsWith('/like') && method !== 'GET') return 'likes'
	if (pathname.endsWith('/follow') && method !== 'GET') return 'follows'
	if (pathname.startsWith('/api/posts') && method !== 'GET') return 'posts_write'
	return 'read'
}

export const limiters = Object.fromEntries(
	Object.entries(RATE_LIMITS).map(([category, rates]) => [category, new RateLimiter(rates)]),
) as Record<RateCategory, RateLimiter>
