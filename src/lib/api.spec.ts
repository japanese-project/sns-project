import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'

function stub_fetch() {
	const fetch_mock = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(
		async () => new Response('{"ok":true}', { status: 200 }),
	)
	vi.stubGlobal('fetch', fetch_mock)
	return fetch_mock
}

afterEach(() => vi.unstubAllGlobals())

describe('api keepalive', () => {
	// keepalive lets a request outlive the page. Without it, a full-page navigation drops the
	// connection and the server never gets to finish handling the request.
	it('passes keepalive through to fetch when requested', async () => {
		const fetch_mock = stub_fetch()
		await api('/api/x', { method: 'POST', body: { a: 1 }, keepalive: true })
		expect(fetch_mock.mock.calls[0][1]).toMatchObject({
			method: 'POST',
			keepalive: true,
			body: '{"a":1}',
		})
	})

	it('does not enable keepalive unless asked to', async () => {
		const fetch_mock = stub_fetch()
		await api('/api/x')
		expect(fetch_mock.mock.calls[0][1]?.keepalive).toBeFalsy()
	})
})
