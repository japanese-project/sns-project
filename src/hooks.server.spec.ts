import { describe, it, expect, vi } from 'vitest'
import { handle } from './hooks.server'
import { rate_limit_for } from '$lib/server/rate-limit'
import type { RateCategory } from '$lib/server/rate-limit'
import type { RequestEvent } from '@sveltejs/kit'

// Every category gets the same tiny budget so the suite never scales with the production limits.
// Raising a limit in production therefore cannot change this file's cost or duration.
const { test_limit } = vi.hoisted(() => ({ test_limit: 3 }))

vi.mock('$lib/server/auth', () => ({
	create_auth: () => ({ api: { getSession: vi.fn().mockResolvedValue(null) } }),
}))

// Keep the real routing table; swap only the limiter for one built on the small test budget.
vi.mock('$lib/server/rate-limit', async (import_original) => {
	const actual = await import_original<typeof import('$lib/server/rate-limit')>()
	const tiny = { IP: [test_limit, 'm'], IPUA: [test_limit, 'm'] } as const
	const limits = Object.fromEntries(
		Object.keys(actual.RATE_LIMITS).map((category) => [category, tiny]),
	) as typeof actual.RATE_LIMITS

	return { ...actual, is_rate_limited: actual.create_rate_limiter(limits) }
})

const fake_event = (pathname: string, ip: string, ua = 'test', method = 'GET') =>
	({
		url: new URL(`http://localhost${pathname}`),
		getClientAddress: () => ip,
		request: new Request(`http://localhost${pathname}`, {
			method,
			headers: { 'user-agent': ua },
		}),
		locals: {},
	}) as unknown as RequestEvent

const resolve = vi.fn().mockResolvedValue(new Response('OK'))

// Every route this app serves under /api, plus the two service-to-service paths that must stay
// exempt. Doubles as the per-category blocking sample: the first entry per category is used.
const routes: [string, string, RateCategory | null][] = [
	['/api/auth/sign-in/social', 'POST', 'auth'],
	['/api/report', 'POST', 'reports'],
	['/api/media', 'POST', 'uploads'],
	['/api/posts', 'POST', 'posts_write'],
	['/api/comments/abc', 'PATCH', 'comments'],
	['/api/posts/abc/like', 'PUT', 'likes'],
	['/api/users/bob/follow', 'PUT', 'follows'],
	['/api/search', 'GET', 'search'],
	['/api/trending', 'GET', 'read'],
	// Same categories again: proves routing does not depend on the specific id in the path.
	['/api/posts', 'GET', 'read'],
	['/api/posts/abc', 'DELETE', 'posts_write'],
	['/api/posts/abc/comments', 'GET', 'comments'],
	['/api/posts/abc/comments', 'POST', 'comments'],
	['/api/posts/abc/like', 'DELETE', 'likes'],
	['/api/users/bob/follow', 'DELETE', 'follows'],
	['/api/media/photo.jpg', 'GET', 'read'],
	['/api/users/bob/followers', 'GET', 'read'],
	['/api/users/bob/following', 'GET', 'read'],
	['/api/users/bob/posts', 'GET', 'read'],
	['/api/notifications/unread-count', 'GET', 'read'],
	['/api/health', 'GET', null],
	['/api/internal/bot-cron', 'POST', null],
]

describe('rate_limit_for', () => {
	for (const [pathname, method, category] of routes) {
		it(`maps ${method} ${pathname} to ${category}`, () => {
			expect(rate_limit_for(pathname, method)).toBe(category)
		})
	}
})

describe('Rate Limiter', () => {
	let client_index = 0
	const next_ip = () => `172.16.0.${++client_index}`

	it('ignores non-api pages', async () => {
		for (let i = 0; i < 20; i++) {
			await handle({ event: fake_event('/explore', '192.168.1.3'), resolve })
		}
		expect(resolve).toHaveBeenCalled()
	})

	// One blocking case per category, using the first route that maps to it.
	const seen = new Set<RateCategory>()
	for (const [pathname, method, category] of routes) {
		if (category === null || seen.has(category)) continue
		seen.add(category)

		it(`blocks ${category} past its own limit`, async () => {
			const ip = next_ip()

			for (let i = 0; i < test_limit; i++) {
				await handle({ event: fake_event(pathname, ip, 'test', method), resolve })
			}

			await expect(
				handle({ event: fake_event(pathname, ip, 'test', method), resolve }),
			).rejects.toMatchObject({ status: 429 })
		})
	}

	it('counts each category separately', async () => {
		const ip = next_ip()

		for (let i = 0; i < test_limit; i++) {
			await handle({ event: fake_event('/api/posts/abc/like', ip, 'test', 'PUT'), resolve })
		}

		await expect(
			handle({ event: fake_event('/api/posts/abc/like', ip, 'test', 'PUT'), resolve }),
		).rejects.toMatchObject({ status: 429 })

		const res = await handle({
			event: fake_event('/api/users/bob/follow', ip, 'test', 'PUT'),
			resolve,
		})
		expect(res.status).toBe(200)
	})

	it('never throttles the health probe', async () => {
		const ip = next_ip()
		// Far above test_limit, so a lost exemption fails loudly instead of passing by luck.
		for (let i = 0; i < 50; i++) {
			const res = await handle({ event: fake_event('/api/health', ip), resolve })
			expect(res.status).toBe(200)
		}
	})
})
