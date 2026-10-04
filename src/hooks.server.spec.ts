import { describe, it, expect, vi } from 'vitest'
import { handle } from './hooks.server'
import { RATE_LIMITS, rate_limit_for } from '$lib/server/rate-limit'
import type { RateCategory } from '$lib/server/rate-limit'
import type { RequestEvent } from '@sveltejs/kit'

vi.mock('$lib/server/auth', () => ({
	create_auth: () => ({ api: { getSession: vi.fn().mockResolvedValue(null) } }),
}))

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

const category_samples: Record<RateCategory, { pathname: string; method: string }> = {
	auth: { pathname: '/api/auth/sign-in/social', method: 'POST' },
	uploads: { pathname: '/api/media', method: 'POST' },
	posts_write: { pathname: '/api/posts', method: 'POST' },
	comments: { pathname: '/api/posts/abc/comments', method: 'POST' },
	likes: { pathname: '/api/posts/abc/like', method: 'PUT' },
	follows: { pathname: '/api/users/bob/follow', method: 'PUT' },
	reports: { pathname: '/api/report', method: 'POST' },
	search: { pathname: '/api/search', method: 'GET' },
	read: { pathname: '/api/trending', method: 'GET' },
}

const resolved: [string, string, RateCategory | null][] = [
	['/api/auth/sign-in/social', 'POST', 'auth'],
	['/api/search', 'GET', 'search'],
	['/api/report', 'POST', 'reports'],
	['/api/media', 'POST', 'uploads'],
	['/api/media/photo.jpg', 'GET', 'read'],
	['/api/posts', 'GET', 'read'],
	['/api/posts', 'POST', 'posts_write'],
	['/api/posts/abc', 'DELETE', 'posts_write'],
	['/api/posts/abc/comments', 'GET', 'comments'],
	['/api/posts/abc/comments', 'POST', 'comments'],
	['/api/comments/abc', 'PATCH', 'comments'],
	['/api/posts/abc/like', 'PUT', 'likes'],
	['/api/posts/abc/like', 'DELETE', 'likes'],
	['/api/users/bob/follow', 'PUT', 'follows'],
	['/api/users/bob/follow', 'DELETE', 'follows'],
	['/api/users/bob/followers', 'GET', 'read'],
	['/api/users/bob/following', 'GET', 'read'],
	['/api/users/bob/posts', 'GET', 'read'],
	['/api/notifications/unread-count', 'GET', 'read'],
	['/api/trending', 'GET', 'read'],
	['/api/health', 'GET', null],
	['/api/internal/bot-cron', 'POST', null],
]

describe('rate_limit_for', () => {
	for (const [pathname, method, category] of resolved) {
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

	for (const [category, sample] of Object.entries(category_samples)) {
		it(`blocks ${category} past its own limit`, async () => {
			const ip = next_ip()
			const { pathname, method } = sample
			const limit = RATE_LIMITS[category as RateCategory].IP[0]

			for (let i = 0; i < limit; i++) {
				await handle({ event: fake_event(pathname, ip, 'test', method), resolve })
			}

			await expect(
				handle({ event: fake_event(pathname, ip, 'test', method), resolve }),
			).rejects.toMatchObject({ status: 429 })
		})
	}

	it('counts each category separately', async () => {
		const ip = next_ip()
		const likes_limit = RATE_LIMITS.likes.IP[0]

		for (let i = 0; i < likes_limit; i++) {
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
		for (let i = 0; i < 200; i++) {
			const res = await handle({ event: fake_event('/api/health', ip), resolve })
			expect(res.status).toBe(200)
		}
	})
})
