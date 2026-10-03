import { describe, expect, it } from 'vitest'
import { GET, POST } from './link-preview/+server'

type GetEvent = Parameters<typeof GET>[0]
type PostEvent = Parameters<typeof POST>[0]

describe('/api/link-preview endpoint', () => {
	it('returns 400 when url parameter is missing in GET', async () => {
		const request = new Request('http://localhost/api/link-preview')
		const url = new URL(request.url)
		const response = await GET({ url } as unknown as GetEvent)
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
		const response = await POST({ request } as unknown as PostEvent)
		expect(response.status).toBe(400)
		const data = (await response.json()) as { error: string }
		expect(data.error).toBe('url property is required')
	})

	it('rejects private / localhost addresses to prevent SSRF', async () => {
		const request = new Request('http://localhost/api/link-preview?url=http://127.0.0.1:8080/admin')
		const url = new URL(request.url)
		const response = await GET({ url } as unknown as GetEvent)
		expect(response.status).toBe(400)
		const data = (await response.json()) as { error: string }
		expect(data.error).toContain('private/local network')
	})
})
