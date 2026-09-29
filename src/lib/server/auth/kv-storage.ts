// Cloudflare KV adapter for Better Auth's secondaryStorage interface.
//
// Better Auth reads/writes sessions, verifications, and rate-limit
// counters through this interface so the hot path avoids a D1 query.

/** Matches Better Auth's SecondaryStorage interface. */
interface SecondaryStorage {
	get: (key: string) => Promise<string | null>
	set: (key: string, value: string, ttl?: number) => Promise<void>
	delete: (key: string) => Promise<void>
	getAndDelete: (key: string) => Promise<string | null>
	increment: (key: string, ttl: number) => Promise<number>
}

export function create_kv_storage(kv: KVNamespace): SecondaryStorage {
	return {
		async get(key: string) {
			return await kv.get(key)
		},

		async set(key: string, value: string, ttl?: number) {
			const options: KVNamespacePutOptions = {}
			if (ttl && ttl > 0) {
				options.expirationTtl = ttl
			}
			await kv.put(key, value, options)
		},

		async delete(key: string) {
			await kv.delete(key)
		},

		async getAndDelete(key: string) {
			const value = await kv.get(key)
			if (value !== null) {
				await kv.delete(key)
			}
			return value
		},

		async increment(key: string, ttl: number) {
			// KV does not support atomic increment, so we read-modify-write.
			// Acceptable for rate limiting on a single-isolate Worker request;
			// truly distributed counters would need Durable Objects, but
			// Better Auth's built-in window is generous enough.
			const raw = await kv.get(key)
			const current = raw ? parseInt(raw, 10) : 0
			const next = current + 1

			const options: KVNamespacePutOptions = {}
			// Only set TTL on first creation (when counter was absent).
			if (current === 0 && ttl > 0) {
				options.expirationTtl = ttl
			}
			await kv.put(key, String(next), options)
			return next
		},
	}
}
