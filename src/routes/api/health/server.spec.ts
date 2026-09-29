import { describe, expect, it, vi } from 'vitest'
import { GET } from './+server'

interface HealthResponse {
	checks: Record<string, string>
	status: string
	timestamp: string
}

describe('GET /api/health', () => {
	it('returns healthy status when bindings are present and operational', async () => {
		const mock_db = {
			prepare: vi.fn().mockReturnValue({
				run: vi.fn().mockResolvedValue({ success: true }),
			}),
		}
		const mock_kv = {
			get: vi.fn().mockResolvedValue(null),
		}

		const event = {
			platform: {
				env: {
					DB: mock_db as unknown as D1Database,
					AUTH_KV: mock_kv as unknown as KVNamespace,
				},
			},
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const response = await GET(event as any)
		const data = (await response.json()) as HealthResponse

		expect(response.status).toBe(200)
		expect(data.status).toBe('healthy')
		expect(data.checks.d1).toBe('ok')
		expect(data.checks.kv).toBe('ok')
	})

	it('returns degraded status when a binding throws', async () => {
		const mock_db = {
			prepare: vi.fn().mockReturnValue({
				run: vi.fn().mockRejectedValue(new Error('Connection failed')),
			}),
		}
		const mock_kv = {
			get: vi.fn().mockResolvedValue(null),
		}

		const event = {
			platform: {
				env: {
					DB: mock_db as unknown as D1Database,
					AUTH_KV: mock_kv as unknown as KVNamespace,
				},
			},
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const response = await GET(event as any)
		const data = (await response.json()) as HealthResponse

		expect(response.status).toBe(503)
		expect(data.status).toBe('degraded')
		expect(data.checks.d1).toBe('Connection failed')
		expect(data.checks.kv).toBe('ok')
	})
})
