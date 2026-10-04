import { describe, it, expect, vi } from 'vitest'
import { unstable_readConfig } from 'wrangler'
import { RATE_LIMITS, is_rate_limited, create_rate_limiter } from './rate-limit'
import type { RequestEvent } from '@sveltejs/kit'

// The in-memory fallback also counts IP+User-Agent, and the library treats a missing User-Agent
// as limited, so give every fake request one (real clients always send it).
const fake_event = (ip: string, env?: Record<string, RateLimit>) =>
	({
		url: new URL('http://localhost/api/trending'),
		getClientAddress: () => ip,
		request: new Request('http://localhost/api/trending', {
			headers: { 'user-agent': 'test' },
		}),
		locals: {},
		platform: env ? { env } : undefined,
	}) as unknown as RequestEvent

// Minimal stand-in for the Cloudflare Rate Limiting binding.
const fake_binding = (success = true) =>
	({
		limit: vi.fn().mockResolvedValue({ success }),
	}) as unknown as RateLimit

describe('is_rate_limited', () => {
	it('uses the binding and reports success as allowed', async () => {
		const binding = fake_binding(true)
		const event = fake_event('10.0.0.1', { RL_120: binding })

		expect(await is_rate_limited('read', event)).toBe(false)
		expect(binding.limit).toHaveBeenCalledWith({ key: 'read:10.0.0.1' })
	})

	it('blocks when the binding reports failure', async () => {
		const event = fake_event('10.0.0.2', { RL_120: fake_binding(false) })
		expect(await is_rate_limited('read', event)).toBe(true)
	})

	it('scopes the key by category so categories sharing a binding stay independent', async () => {
		// comments and follows both sit at 30/min, so both resolve to the RL_30 binding.
		const binding = fake_binding(true)
		const env = { RL_30: binding }

		await is_rate_limited('comments', fake_event('10.0.0.3', env))
		await is_rate_limited('follows', fake_event('10.0.0.3', env))

		expect(binding.limit).toHaveBeenNthCalledWith(1, { key: 'comments:10.0.0.3' })
		expect(binding.limit).toHaveBeenNthCalledWith(2, { key: 'follows:10.0.0.3' })
	})

	it('falls back to the in-memory limiter when no binding is bound', async () => {
		// Prerendering and unit tests have no platform env; this must not throw.
		expect(await is_rate_limited('read', fake_event('10.0.0.4'))).toBe(false)
	})

	it('allows exactly the configured number of requests before blocking', async () => {
		// Small injectable budget: this cost is fixed no matter what production limits become.
		const small = create_rate_limiter({ ...RATE_LIMITS, read: { IP: [3, 'm'], IPUA: [3, 'm'] } })

		for (let i = 0; i < 3; i++) {
			expect(await small('read', fake_event('10.0.0.5'))).toBe(false)
		}
		expect(await small('read', fake_event('10.0.0.5'))).toBe(true)
	})
})

// The limit has to live in two places: RATE_LIMITS for the in-memory fallback and the wrangler
// bindings for production. These fail if the two drift apart.
describe('wrangler ratelimits bindings', () => {
	type Binding = { name: string; namespace_id: string; simple: { limit: number; period: number } }

	const bindings_for = async (env: 'preview' | undefined): Promise<Binding[]> => {
		const config = await unstable_readConfig({ configPath: 'wrangler.jsonc', env })
		return (config.ratelimits ?? []) as Binding[]
	}

	for (const env of [undefined, 'preview'] as const) {
		it(`${env ?? 'production'} declares one 60s binding per distinct limit`, async () => {
			const bindings = await bindings_for(env)
			const expected = [...new Set(Object.values(RATE_LIMITS).map((r) => r.IP[0]))].sort(
				(a, b) => a - b,
			)

			// The name is derived from the limit, so checking it covers the lookup key too.
			expect(
				bindings
					.map((b) => [b.name, b.simple.limit, b.simple.period] as const)
					.sort((a, b) => a[1] - b[1]),
			).toEqual(expected.map((limit) => [`RL_${limit}`, limit, 60]))
		})

		it(`${env ?? 'production'} uses unique namespace ids`, async () => {
			const ids = (await bindings_for(env)).map((b) => b.namespace_id)

			expect(new Set(ids).size).toBe(ids.length)
		})
	}
})
