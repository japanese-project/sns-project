import { describe, expect, it, vi } from 'vitest'
import { MAX_COMMENT_LENGTH } from '$lib/limits'
import { check_comment_abuse } from './abuse-protection'

function create_mock_kv() {
	const store = new Map<string, string>()
	return {
		get: vi.fn(async (key: string) => store.get(key) ?? null),
		put: vi.fn(async (key: string, value: string) => {
			store.set(key, value)
		}),
	}
}

describe('comment abuse protection', () => {
	it('rejects empty and overlong comments', async () => {
		const kv = create_mock_kv()
		expect(await check_comment_abuse(kv, 'user-1', '  ')).toMatchObject({
			allowed: false,
			reason: 'empty_content',
		})
		expect(
			await check_comment_abuse(kv, 'user-1', 'x'.repeat(MAX_COMMENT_LENGTH + 1)),
		).toMatchObject({
			allowed: false,
			reason: 'content_too_long',
		})
	})

	it('normalizes and records an allowed comment', async () => {
		const kv = create_mock_kv()
		const result = await check_comment_abuse(kv, 'user-1', '  A useful   comment  ', 100_000)

		expect(result).toMatchObject({ allowed: true, normalizedContent: 'A useful comment' })
		expect(kv.put).toHaveBeenCalledOnce()
	})

	it('limits rapid comments server-side', async () => {
		const kv = create_mock_kv()
		expect(await check_comment_abuse(kv, 'user-1', 'first', 100_000)).toMatchObject({
			allowed: true,
		})
		expect(await check_comment_abuse(kv, 'user-1', 'another', 101_000)).toMatchObject({
			allowed: false,
			reason: 'too_fast',
		})
	})

	it('caps comments per minute', async () => {
		const kv = create_mock_kv()
		for (let i = 0; i < 6; i++) {
			expect(
				await check_comment_abuse(kv, 'user-1', `comment ${i}`, 100_000 + i * 2_000),
			).toMatchObject({ allowed: true })
		}

		expect(await check_comment_abuse(kv, 'user-1', 'comment 7', 112_000)).toMatchObject({
			allowed: false,
			reason: 'rate_limited',
		})
	})
})
