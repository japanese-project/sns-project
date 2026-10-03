import { MAX_COMMENT_LENGTH } from '$lib/limits'

interface CommentAbuseKV {
	get(key: string, options: { type: 'text' }): Promise<string | null>
	put(key: string, value: string, options?: KVNamespacePutOptions): Promise<void>
}

interface CommentCheck {
	allowed: boolean
	normalizedContent?: string
	reason?: 'empty_content' | 'content_too_long' | 'too_fast' | 'rate_limited'
	retryAfterSeconds?: number
}

const minute_ms = 60_000
const max_comments_per_minute = 6
const min_interval_ms = 1_500

export async function check_comment_abuse(
	kv: CommentAbuseKV,
	user_id: string,
	content: unknown,
	now = Date.now(),
): Promise<CommentCheck> {
	if (typeof content !== 'string') return { allowed: false, reason: 'empty_content' }
	const normalized_content = content.replace(/\s+/g, ' ').trim()
	if (!normalized_content) return { allowed: false, reason: 'empty_content' }
	if (normalized_content.length > MAX_COMMENT_LENGTH) {
		return { allowed: false, reason: 'content_too_long' }
	}

	const key = `comment-abuse:${user_id}`
	const stored = await kv.get(key, { type: 'text' })
	const recent: number[] = stored ? JSON.parse(stored) : []
	const timestamps = recent.filter((time) => now - time < minute_ms)
	const last_comment = timestamps.at(-1)

	if (last_comment !== undefined && now - last_comment < min_interval_ms) {
		return {
			allowed: false,
			reason: 'too_fast',
			retryAfterSeconds: Math.ceil((min_interval_ms - (now - last_comment)) / 1000),
		}
	}

	if (timestamps.length >= max_comments_per_minute) {
		return {
			allowed: false,
			reason: 'rate_limited',
			retryAfterSeconds: Math.max(1, Math.ceil((minute_ms - (now - timestamps[0])) / 1000)),
		}
	}

	timestamps.push(now)
	await kv.put(key, JSON.stringify(timestamps), { expirationTtl: minute_ms / 1000 })
	return { allowed: true, normalizedContent: normalized_content }
}
