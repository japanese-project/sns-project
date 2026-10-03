// src/hooks.server.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { handle } from './hooks.server'
import type { RequestEvent } from '@sveltejs/kit'

const fake_event = (pathname: string, ip: string, ua = 'test') =>
	({
		url: new URL(`http://localhost${pathname}`),
		getClientAddress: () => ip,
		request: new Request(`http://localhost${pathname}`, {
			headers: { 'user-agent': ua },
		}),
		locals: {},
	}) as unknown as RequestEvent

const resolve = vi.fn().mockResolvedValue(new Response('OK'))

describe('Rate Limiter', () => {
	it('allows normal request', async () => {
		const event = fake_event('/api/users', '1.1.1.1')
		const res = await handle({ event, resolve })
		expect(res.status).toBe(200)
	})

	it('blocks after hitting the limit', async () => {
		const ip = '192.168.1.2'

		// Run exactly 14 allowed requests
		for (let i = 0; i < 14; i++) {
			await handle({ event: fake_event('/api/posts', ip), resolve })
		}

		// The 15th request gets blocked with a 429
		await expect(handle({ event: fake_event('/api/posts', ip), resolve })).rejects.toMatchObject({
			status: 429,
		})
	})

	it('ignores non-api pages', async () => {
		for (let i = 0; i < 20; i++) {
			await handle({ event: fake_event('/explore', '192.168.1.3'), resolve })
		}
		expect(resolve).toHaveBeenCalled()
	})
})
