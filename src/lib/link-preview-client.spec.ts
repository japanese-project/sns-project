import { describe, expect, it } from 'vitest'
import { extract_first_url } from './link-preview-client'

describe('extract_first_url', () => {
	it('returns null when text has no URLs', () => {
		expect(extract_first_url('')).toBeNull()
		expect(extract_first_url('Hello world this is a test without links')).toBeNull()
		expect(extract_first_url('Check out #vibecoding and #ai!')).toBeNull()
	})

	it('extracts standard https URL from text', () => {
		expect(extract_first_url('Check this out: https://github.com/sveltejs/kit')).toBe(
			'https://github.com/sveltejs/kit',
		)
	})

	it('cleans trailing punctuation', () => {
		expect(extract_first_url('Visit https://news.ycombinator.com.')).toBe(
			'https://news.ycombinator.com',
		)
		expect(extract_first_url('(read more at https://techcrunch.com/article!)')).toBe(
			'https://techcrunch.com/article',
		)
	})

	it('adds https prefix to www URLs', () => {
		expect(extract_first_url('Go to www.cloudflare.com today')).toBe('https://www.cloudflare.com')
	})

	it('returns the first URL when multiple URLs are present', () => {
		const text = 'First https://first.com and then https://second.com'
		expect(extract_first_url(text)).toBe('https://first.com')
	})
})
