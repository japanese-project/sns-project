import { describe, it, expect, vi } from 'vitest'
import { create_kv_storage } from './kv-storage'

function create_mock_kv(): KVNamespace {
	const map = new Map<string, { value: string; expiration_ttl?: number }>()

	return {
		get: vi.fn(async (key: string) => {
			const item = map.get(key)
			return item ? item.value : null
		}),
		put: vi.fn(async (key: string, value: string, options?: KVNamespacePutOptions) => {
			map.set(key, { value, expiration_ttl: options?.expirationTtl })
		}),
		delete: vi.fn(async (key: string) => {
			map.delete(key)
		}),
		list: vi.fn(),
		getWithMetadata: vi.fn(),
	} as unknown as KVNamespace
}

describe('create_kv_storage', () => {
	it('gets a value from KV', async () => {
		const mock_kv = create_mock_kv()
		const storage = create_kv_storage(mock_kv)

		await storage.set('session:1', 'user-data')
		const result = await storage.get('session:1')

		expect(result).toBe('user-data')
		expect(mock_kv.get).toHaveBeenCalledWith('session:1')
	})

	it('returns null for missing key', async () => {
		const mock_kv = create_mock_kv()
		const storage = create_kv_storage(mock_kv)

		const result = await storage.get('nonexistent')
		expect(result).toBeNull()
	})

	it('sets a value with ttl', async () => {
		const mock_kv = create_mock_kv()
		const storage = create_kv_storage(mock_kv)

		await storage.set('session:1', 'user-data', 3600)
		expect(mock_kv.put).toHaveBeenCalledWith('session:1', 'user-data', {
			expirationTtl: 3600,
		})
	})

	it('deletes a value', async () => {
		const mock_kv = create_mock_kv()
		const storage = create_kv_storage(mock_kv)

		await storage.set('session:1', 'user-data')
		await storage.delete('session:1')

		const result = await storage.get('session:1')
		expect(result).toBeNull()
		expect(mock_kv.delete).toHaveBeenCalledWith('session:1')
	})

	it('gets and deletes a value atomically', async () => {
		const mock_kv = create_mock_kv()
		const storage = create_kv_storage(mock_kv)

		await storage.set('verify:token', 'valid')
		const result = await storage.getAndDelete('verify:token')

		expect(result).toBe('valid')
		const after = await storage.get('verify:token')
		expect(after).toBeNull()
	})

	it('increments a rate limit counter', async () => {
		const mock_kv = create_mock_kv()
		const storage = create_kv_storage(mock_kv)

		const first = await storage.increment('rate:user1', 60)
		expect(first).toBe(1)

		const second = await storage.increment('rate:user1', 60)
		expect(second).toBe(2)
	})
})
