import { describe, expect, it } from 'vitest'
import { parse_content } from './content'

describe('parse_content', () => {
	it('handles empty or whitespace strings', () => {
		expect(parse_content('')).toEqual([])
		expect(parse_content('   ')).toEqual([{ type: 'text', text: '   ' }])
	})

	it('returns plain text when there are no hashtags or links', () => {
		expect(parse_content('Just some plain text here.')).toEqual([
			{ type: 'text', text: 'Just some plain text here.' },
		])
	})

	it('parses hashtags correctly', () => {
		const result = parse_content('Hello #world and #coding_ai!')
		expect(result).toEqual([
			{ type: 'text', text: 'Hello ' },
			{ type: 'tag', text: '#world', href: '/explore?q=%23world' },
			{ type: 'text', text: ' and ' },
			{ type: 'tag', text: '#coding_ai', href: '/explore?q=%23coding_ai' },
			{ type: 'text', text: '!' },
		])
	})

	it('parses non-latin (Japanese) hashtags', () => {
		const result = parse_content('アニメ感想 #アニメ #チェンソーマン')
		expect(result).toEqual([
			{ type: 'text', text: 'アニメ感想 ' },
			{ type: 'tag', text: '#アニメ', href: '/explore?q=%23%E3%82%A2%E3%83%8B%E3%83%A1' },
			{ type: 'text', text: ' ' },
			{
				type: 'tag',
				text: '#チェンソーマン',
				href: '/explore?q=%23%E3%83%81%E3%82%A7%E3%83%B3%E3%82%BD%E3%83%BC%E3%83%9E%E3%83%B3',
			},
		])
	})

	it('parses http and https URLs into links', () => {
		const result = parse_content(
			'Read this: https://simonwillison.net/2026/Oct/1/matthew-green/ for info',
		)
		expect(result).toEqual([
			{ type: 'text', text: 'Read this: ' },
			{
				type: 'link',
				text: 'https://simonwillison.net/2026/Oct/1/matthew-green/',
				href: 'https://simonwillison.net/2026/Oct/1/matthew-green/',
			},
			{ type: 'text', text: ' for info' },
		])
	})

	it('strips trailing punctuation from URLs and preserves it as text', () => {
		const result = parse_content('Check out https://example.com/test.')
		expect(result).toEqual([
			{ type: 'text', text: 'Check out ' },
			{ type: 'link', text: 'https://example.com/test', href: 'https://example.com/test' },
			{ type: 'text', text: '.' },
		])
	})

	it('handles URLs wrapped in parentheses', () => {
		const result = parse_content('(see https://example.com/demo)')
		expect(result).toEqual([
			{ type: 'text', text: '(see ' },
			{ type: 'link', text: 'https://example.com/demo', href: 'https://example.com/demo' },
			{ type: 'text', text: ')' },
		])
	})

	it('preserves balanced parentheses in URLs (e.g. Wikipedia)', () => {
		const result = parse_content('https://en.wikipedia.org/wiki/Rust_(programming_language)')
		expect(result).toEqual([
			{
				type: 'link',
				text: 'https://en.wikipedia.org/wiki/Rust_(programming_language)',
				href: 'https://en.wikipedia.org/wiki/Rust_(programming_language)',
			},
		])
	})

	it('preserves hash fragments inside URLs without breaking them into tags', () => {
		const result = parse_content('Go to https://example.com/doc#getting-started to begin.')
		expect(result).toEqual([
			{ type: 'text', text: 'Go to ' },
			{
				type: 'link',
				text: 'https://example.com/doc#getting-started',
				href: 'https://example.com/doc#getting-started',
			},
			{ type: 'text', text: ' to begin.' },
		])
	})

	it('converts www. domains to https links', () => {
		const result = parse_content('Visit www.cloudflare.com today')
		expect(result).toEqual([
			{ type: 'text', text: 'Visit ' },
			{
				type: 'link',
				text: 'www.cloudflare.com',
				href: 'https://www.cloudflare.com',
			},
			{ type: 'text', text: ' today' },
		])
	})

	it('parses typical bot post with text, link, and hashtags', () => {
		const bot_post =
			'Tool-use and multi-agent coordination getting better every week.\n\nQuoting Matthew Green\nhttps://simonwillison.net/2026/Oct/1/matthew-green/\n\n#agents #ai #engineering'

		const result = parse_content(bot_post)
		expect(result).toEqual([
			{
				type: 'text',
				text: 'Tool-use and multi-agent coordination getting better every week.\n\nQuoting Matthew Green\n',
			},
			{
				type: 'link',
				text: 'https://simonwillison.net/2026/Oct/1/matthew-green/',
				href: 'https://simonwillison.net/2026/Oct/1/matthew-green/',
			},
			{ type: 'text', text: '\n\n' },
			{ type: 'tag', text: '#agents', href: '/explore?q=%23agents' },
			{ type: 'text', text: ' ' },
			{ type: 'tag', text: '#ai', href: '/explore?q=%23ai' },
			{ type: 'text', text: ' ' },
			{ type: 'tag', text: '#engineering', href: '/explore?q=%23engineering' },
		])
	})

	it('omits preview_url when exclude_url option is provided to unify link and preview', () => {
		const post = 'Check out this awesome tool! https://github.com/trending #coding'
		const result = parse_content(post, { exclude_url: 'https://github.com/trending' })
		expect(result).toEqual([
			{ type: 'text', text: 'Check out this awesome tool! ' },
			{ type: 'tag', text: '#coding', href: '/explore?q=%23coding' },
		])
	})

	it('returns empty array if post consists solely of the excluded preview URL', () => {
		const post = 'https://github.com/trending'
		const result = parse_content(post, { exclude_url: 'https://github.com/trending' })
		expect(result).toEqual([])
	})
})
