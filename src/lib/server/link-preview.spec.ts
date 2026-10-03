import { describe, expect, it } from 'vitest'
import {
	decode_html_entities,
	is_private_or_restricted_host,
	parse_html_metadata,
} from './link-preview'

describe('Link Preview Utilities', () => {
	describe('SSRF Protection (is_private_or_restricted_host)', () => {
		it('blocks localhost and loopbacks', () => {
			expect(is_private_or_restricted_host('localhost')).toBe(true)
			expect(is_private_or_restricted_host('127.0.0.1')).toBe(true)
			expect(is_private_or_restricted_host('127.0.0.2')).toBe(true)
			expect(is_private_or_restricted_host('0.0.0.0')).toBe(true)
			expect(is_private_or_restricted_host('::1')).toBe(true)
			expect(is_private_or_restricted_host('[::1]')).toBe(true)
		})

		it('blocks private IPv4 subnets', () => {
			expect(is_private_or_restricted_host('10.0.0.1')).toBe(true)
			expect(is_private_or_restricted_host('192.168.1.100')).toBe(true)
			expect(is_private_or_restricted_host('172.16.0.1')).toBe(true)
			expect(is_private_or_restricted_host('172.31.255.255')).toBe(true)
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
