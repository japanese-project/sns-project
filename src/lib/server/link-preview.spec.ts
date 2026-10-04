import { describe, expect, it, vi } from 'vitest'
import {
	check_preview_rate_limit,
	decode_html_entities,
	fetch_link_preview,
	is_private_or_restricted_host,
	parse_html_metadata,
	validate_preview_url,
} from './link-preview'

describe('Link Preview Utilities', () => {
	describe('SSRF Protection (is_private_or_restricted_host & validate_preview_url)', () => {
		it('blocks localhost and loopbacks', () => {
			expect(is_private_or_restricted_host('localhost')).toBe(true)
			expect(is_private_or_restricted_host('127.0.0.1')).toBe(true)
			expect(is_private_or_restricted_host('127.0.0.2')).toBe(true)
			expect(is_private_or_restricted_host('0.0.0.0')).toBe(true)
			expect(is_private_or_restricted_host('::1')).toBe(true)
			expect(is_private_or_restricted_host('[::1]')).toBe(true)
			expect(is_private_or_restricted_host('::')).toBe(true)
		})

		it('blocks private IPv4 subnets and carrier NAT', () => {
			expect(is_private_or_restricted_host('10.0.0.1')).toBe(true)
			expect(is_private_or_restricted_host('192.168.1.100')).toBe(true)
			expect(is_private_or_restricted_host('172.16.0.1')).toBe(true)
			expect(is_private_or_restricted_host('172.31.255.255')).toBe(true)
			expect(is_private_or_restricted_host('100.64.0.1')).toBe(true)
		})

		it('blocks AWS/cloud link-local metadata IP', () => {
			expect(is_private_or_restricted_host('169.254.169.254')).toBe(true)
		})

		it('blocks internal/local TLDs', () => {
			expect(is_private_or_restricted_host('my-service.local')).toBe(true)
			expect(is_private_or_restricted_host('api.internal')).toBe(true)
			expect(is_private_or_restricted_host('dev.localhost')).toBe(true)
		})

		it('allows valid public domains', () => {
			expect(is_private_or_restricted_host('github.com')).toBe(false)
			expect(is_private_or_restricted_host('news.ycombinator.com')).toBe(false)
			expect(is_private_or_restricted_host('techcrunch.com')).toBe(false)
			expect(is_private_or_restricted_host('animenewsnetwork.com')).toBe(false)
		})

		it('validates URL formats and scheme', () => {
			expect(() => validate_preview_url('ftp://example.com')).toThrow('Unsupported protocol')
			expect(() => validate_preview_url('javascript:alert(1)')).toThrow('Unsupported protocol')
			expect(() => validate_preview_url('http://169.254.169.254/latest/meta-data')).toThrow(
				'Access to private/local network addresses is prohibited',
			)
			const parsed = validate_preview_url('https://github.com/trending')
			expect(parsed.hostname).toBe('github.com')
		})
	})

	describe('Redirect SSRF validation (fetch_link_preview)', () => {
		it('aborts when redirected to a private IP address', async () => {
			const original_fetch = globalThis.fetch
			// Simulate 302 redirecting to AWS metadata
			const mock_fetch = vi.fn().mockResolvedValue({
				status: 302,
				ok: false,
				headers: new Headers({
					location: 'http://169.254.169.254/latest/meta-data',
				}),
			})
			globalThis.fetch = mock_fetch as unknown as typeof fetch

			try {
				await expect(fetch_link_preview('https://public-redirector.com/test')).rejects.toThrow(
					'Access to private/local network addresses is prohibited',
				)
			} finally {
				globalThis.fetch = original_fetch
			}
		})

		it('aborts when redirected to localhost', async () => {
			const original_fetch = globalThis.fetch
			const mock_fetch = vi.fn().mockResolvedValue({
				status: 301,
				ok: false,
				headers: new Headers({
					location: 'http://localhost:8080/secret',
				}),
			})
			globalThis.fetch = mock_fetch as unknown as typeof fetch

			try {
				await expect(fetch_link_preview('https://public-site.com/goto')).rejects.toThrow(
					'Access to private/local network addresses is prohibited',
				)
			} finally {
				globalThis.fetch = original_fetch
			}
		})
	})

	describe('Rate Limiting (check_preview_rate_limit)', () => {
		it('allows up to 15 requests in window and rejects excess', async () => {
			const client_id = `test-client-${Date.now()}`
			const now = 1_000_000

			// 15 allowed requests
			for (let i = 0; i < 15; i++) {
				const res = await check_preview_rate_limit(client_id, null, now + i * 100)
				expect(res.allowed).toBe(true)
			}

			// 16th request rejected
			const rejected = await check_preview_rate_limit(client_id, null, now + 2000)
			expect(rejected.allowed).toBe(false)
			expect(rejected.retry_after_seconds).toBeGreaterThan(0)
		})

		it('works with KV storage interface', async () => {
			const store = new Map<string, string>()
			const mock_kv = {
				async get(key: string) {
					return store.get(key) ?? null
				},
				async put(key: string, value: string) {
					store.set(key, value)
				},
			}

			const client_id = 'kv-user-123'
			const now = 2_000_000

			for (let i = 0; i < 15; i++) {
				const res = await check_preview_rate_limit(client_id, mock_kv, now + i * 50)
				expect(res.allowed).toBe(true)
			}

			const rejected = await check_preview_rate_limit(client_id, mock_kv, now + 1000)
			expect(rejected.allowed).toBe(false)
		})
	})

	describe('HTML Entity Decoding', () => {
		it('decodes common entities correctly', () => {
			expect(decode_html_entities('Tom &amp; Jerry')).toBe('Tom & Jerry')
			expect(decode_html_entities('Say &quot;Hello&quot;')).toBe('Say "Hello"')
			expect(decode_html_entities('It&#39;s a test')).toBe("It's a test")
			expect(decode_html_entities('A &lt; B &gt; C')).toBe('A < B > C')
		})
	})

	describe('parse_html_metadata', () => {
		it('extracts Open Graph tags correctly', () => {
			const html = `
				<!DOCTYPE html>
				<html>
				<head>
					<meta property="og:title" content="Awesome Open Source Project" />
					<meta property="og:description" content="A tool that simplifies modern development." />
					<meta property="og:image" content="https://example.com/assets/og.png" />
					<meta property="og:site_name" content="GitHub" />
				</head>
				<body></body>
				</html>
			`
			const result = parse_html_metadata(html, 'https://github.com/example/repo')
			expect(result.title).toBe('Awesome Open Source Project')
			expect(result.description).toBe('A tool that simplifies modern development.')
			expect(result.image).toBe('https://example.com/assets/og.png')
			expect(result.site_name).toBe('GitHub')
			expect(result.domain).toBe('github.com')
		})

		it('resolves relative image URLs against the base URL', () => {
			const html = `
				<title>Blog Post</title>
				<meta property="og:image" content="/images/header.jpg" />
			`
			const result = parse_html_metadata(html, 'https://blog.example.com/posts/hello')
			expect(result.image).toBe('https://blog.example.com/images/header.jpg')
		})

		it('falls back to Twitter tags and standard title when Open Graph tags are missing', () => {
			const html = `
				<title>Ars Technica Science News</title>
				<meta name="description" content="Deep dive into quantum computing breakthroughs." />
				<meta name="twitter:image" content="https://arstechnica.com/img/cover.jpg" />
			`
			const result = parse_html_metadata(html, 'https://arstechnica.com/science')
			expect(result.title).toBe('Ars Technica Science News')
			expect(result.description).toBe('Deep dive into quantum computing breakthroughs.')
			expect(result.image).toBe('https://arstechnica.com/img/cover.jpg')
			expect(result.domain).toBe('arstechnica.com')
		})

		it('gracefully handles missing tags and provides domain fallbacks', () => {
			const html = `<html><body>No metadata here</body></html>`
			const result = parse_html_metadata(html, 'https://simple.org/page')
			expect(result.title).toBe('simple.org')
			expect(result.domain).toBe('simple.org')
			expect(result.site_name).toBe('simple.org')
			expect(result.description).toBeUndefined()
			expect(result.image).toBeUndefined()
		})
	})
})
