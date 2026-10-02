import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db'
import { cleanup_orphaned_media, get_storage_stats, identify_orphaned_media } from './media'
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
})
