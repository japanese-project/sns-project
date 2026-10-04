import { describe, expect, it } from 'vitest'
import { GET, POST } from './link-preview/+server'

type GetEvent = Parameters<typeof GET>[0]
type PostEvent = Parameters<typeof POST>[0]

function create_mock_event(
	request: Request,
	options: {
		url?: URL
		locals?: { user?: { id: string } | null }
		platform?: App.Platform
	} = {},
) {
	const url = options.url ?? new URL(request.url)
	return {
		request,
		url,
		locals: options.locals ?? { user: { id: 'mock-user-1' } },
		platform: options.platform,
		getClientAddress: () => '198.51.100.1',
	}
}

describe('/api/link-preview endpoint', () => {
	it('rejects unauthenticated requests with 401', async () => {
		const request = new Request('http://localhost/api/link-preview?url=https://example.com')
		const event = create_mock_event(request, { locals: {} as App.Locals })
		await expect(GET(event as unknown as GetEvent)).rejects.toMatchObject({ status: 401 })
	})

	it('returns 400 when url parameter is missing in GET', async () => {
		const request = new Request('http://localhost/api/link-preview')
		const event = create_mock_event(request)
		const response = await GET(event as unknown as GetEvent)
		expect(response.status).toBe(400)
		const data = (await response.json()) as { error: string }
		expect(data.error).toBe('url parameter is required')
	})

	it('returns 400 when body is empty in POST', async () => {
		const request = new Request('http://localhost/api/link-preview', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		})
		const event = create_mock_event(request)
		const response = await POST(event as unknown as PostEvent)
		expect(response.status).toBe(400)
		const data = (await response.json()) as { error: string }
		expect(data.error).toBe('url property is required')
	})

	it('rejects private / localhost addresses to prevent SSRF', async () => {
		const request = new Request('http://localhost/api/link-preview?url=http://127.0.0.1:8080/admin')
		const event = create_mock_event(request)
		const response = await GET(event as unknown as GetEvent)
		expect(response.status).toBe(400)
		const data = (await response.json()) as { error: string }
		expect(data.error).toContain('private/local network')
	})

	it('enforces rate limiting when too many requests arrive from same client', async () => {
		const client_id_prefix = `rate-test-${Date.now()}`
		let last_response: Response | null = null

		for (let i = 0; i < 16; i++) {
			const request = new Request(
				'http://localhost/api/link-preview?url=https://example.com/test',
				{
					headers: { 'cf-connecting-ip': client_id_prefix },
				},
			)
			const event = create_mock_event(request)
			last_response = await GET(event as unknown as GetEvent)
		}

		// The 16th request should hit rate limit (status 429)
		expect(last_response?.status).toBe(429)
		const data = (await last_response?.json()) as { error: string; retryAfterSeconds: number }
		expect(data.error).toBe('rate_limited')
		expect(data.retryAfterSeconds).toBeGreaterThan(0)
	})
})
