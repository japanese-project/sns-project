import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db'
import {
	cleanup_orphaned_media,
	get_storage_stats,
	identify_orphaned_media,
	is_media_referenced,
} from './media'
import { create_post } from './posts'
import { create_test_db, make_user } from './test-db'

describe('Media service and lifecycle', () => {
	let db: Db
	let bucket: R2Bucket
	let dispose: () => Promise<void>
	let alice: string

	beforeAll(async () => {
		const ctx = await create_test_db()
		db = ctx.db
		bucket = ctx.bucket
		dispose = ctx.dispose
		alice = await make_user(db, 'Alice')
	})

	afterAll(async () => {
		await dispose()
	})

	beforeEach(async () => {
		const list = await bucket.list()
		for (const obj of list.objects) {
			await bucket.delete(obj.key)
		}
	})

	it('computes storage statistics accurately', async () => {
		// 1. Upload two media items to bucket
		const img1_key = 'img-1.jpg'
		const img2_key = 'img-2.png'
		await bucket.put(img1_key, new Uint8Array([1, 2, 3, 4]), {
			customMetadata: { userId: alice, uploadedAt: Date.now().toString() },
		})
		await bucket.put(img2_key, new Uint8Array([5, 6, 7]), {
			customMetadata: { userId: alice, uploadedAt: Date.now().toString() },
		})

		// 2. Attach img1 to a post, leaving img2 orphaned
		await create_post(
			db,
			alice,
			{
				content: 'Post with img1',
				visibility: 'public',
				imageUrl: `/api/media/${img1_key}`,
			},
			bucket,
		)

		const stats = await get_storage_stats(db, bucket)
		expect(stats.total_objects).toBe(2)
		expect(stats.total_bytes).toBe(7)
		expect(stats.referenced_objects).toBe(1)
		expect(stats.orphaned_objects).toBe(1)
		expect(stats.orphaned_bytes).toBe(3)
	})

	it('identifies and cleans up orphaned media objects', async () => {
		const active_key = 'active.jpg'
		const orphan_key = 'orphan.png'
		await bucket.put(active_key, new Uint8Array([1, 2]), {
			customMetadata: { userId: alice, uploadedAt: Date.now().toString() },
		})
		await bucket.put(orphan_key, new Uint8Array([3, 4, 5]), {
			customMetadata: { userId: alice, uploadedAt: Date.now().toString() },
		})

		await create_post(
			db,
			alice,
			{
				content: 'Active post',
				visibility: 'public',
				imageUrl: `/api/media/${active_key}`,
			},
			bucket,
		)

		// Identify with 0 threshold so all orphans are returned
		const orphans = await identify_orphaned_media(db, bucket, 0)
		expect(orphans).toHaveLength(1)
		expect(orphans[0].key).toBe(orphan_key)
		expect(orphans[0].size).toBe(3)

		// Cleanup
		const result = await cleanup_orphaned_media(db, bucket, 0)
		expect(result.deleted_count).toBe(1)
		expect(result.reclaimed_bytes).toBe(3)
		expect(result.deleted_keys).toEqual([orphan_key])

		// Active object must remain
		const active_obj = await bucket.head(active_key)
		expect(active_obj).not.toBeNull()

		// Orphaned object must be deleted
		const orphan_obj = await bucket.head(orphan_key)
		expect(orphan_obj).toBeNull()
	})

	it('checks media reference status accurately', async () => {
		const key = 'check-ref.jpg'
		await bucket.put(key, new Uint8Array([1, 2]), {
			customMetadata: { userId: alice, uploadedAt: Date.now().toString() },
		})
		expect(await is_media_referenced(db, key)).toBe(false)

		await create_post(
			db,
			alice,
			{
				content: 'Post with ref',
				visibility: 'public',
				imageUrl: `/api/media/${key}`,
			},
			bucket,
		)

		expect(await is_media_referenced(db, key)).toBe(true)
	})

	it('prevents race conditions by re-checking reference immediately before deletion', async () => {
		const raced_key = 'raced-item.jpg'
		const true_orphan_key = 'true-orphan.jpg'

		await bucket.put(raced_key, new Uint8Array([1, 2, 3]), {
			customMetadata: { userId: alice, uploadedAt: Date.now().toString() },
		})
		await bucket.put(true_orphan_key, new Uint8Array([4, 5]), {
			customMetadata: { userId: alice, uploadedAt: Date.now().toString() },
		})

		// Use a proxy wrapper on R2Bucket to simulate concurrent post creation:
		// Right after orphan candidates are identified (after list() finishes),
		// a post is created referencing raced_key before deletion happens.
		let post_created = false
		const proxy_bucket = new Proxy(bucket, {
			get(target, prop, receiver) {
				const value = Reflect.get(target, prop, receiver)
				if (prop === 'list') {
					return async (...args: unknown[]) => {
						const list_fn = value as (...a: unknown[]) => Promise<R2Objects>
						const res = await list_fn.apply(target, args)
						if (!post_created) {
							post_created = true
							await create_post(
								db,
								alice,
								{
									content: 'Concurrent attachment during cleanup window',
									visibility: 'public',
									imageUrl: `/api/media/${raced_key}`,
								},
								bucket,
							)
						}
						return res
					}
				}
				if (typeof value === 'function') {
					return value.bind(target)
				}
				return value
			},
		})

		const result = await cleanup_orphaned_media(db, proxy_bucket, 0)
		// raced_key must NOT be deleted because it became referenced before deletion
		expect(result.deleted_keys).not.toContain(raced_key)
		expect(result.deleted_keys).toContain(true_orphan_key)

		// Verify raced_key is still intact in R2
		const raced_obj = await bucket.head(raced_key)
		expect(raced_obj).not.toBeNull()

		// Verify true_orphan_key was deleted
		const orphan_obj = await bucket.head(true_orphan_key)
		expect(orphan_obj).toBeNull()
	})
})
