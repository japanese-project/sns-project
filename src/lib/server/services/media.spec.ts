import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, lt } from 'drizzle-orm'
import type { Db } from '../db'
import {
	cleanup_orphaned_media,
	get_storage_stats,
	identify_orphaned_media,
	is_media_referenced,
	with_media_lock,
} from './media'
import { media_cleanup_lock } from '../db/schema'
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

	it('synchronizes distributed cleanup and attachment across isolated instances via D1 lock', async () => {
		const distributed_key = 'distributed-test.jpg'
		await bucket.put(distributed_key, new Uint8Array([7, 8, 9]), {
			customMetadata: { userId: alice, uploadedAt: Date.now().toString() },
		})

		// Simulate two separate worker instances:
		// Instance 1 (Cleanup) acquires lock in DB for distributed_key
		// Instance 2 (Post creation) attempts to attach distributed_key
		// Because Instance 1 holds the DB lock, Instance 2 must wait until cleanup finishes.
		// When cleanup finishes and deletes the object, Instance 2 discovers the object is gone and fails cleanly with 400.
		let cleanup_started = false
		let post_error: unknown = null

		const cleanup_promise = cleanup_orphaned_media(
			db,
			new Proxy(bucket, {
				get(target, prop, receiver) {
					if (prop === 'delete') {
						return async (...args: unknown[]) => {
							cleanup_started = true
							// Give post creation a window to attempt execution concurrently
							await new Promise((r) => setTimeout(r, 100))
							const del_fn = Reflect.get(target, prop, receiver) as (
								...a: unknown[]
							) => Promise<void>
							return await del_fn.apply(target, args)
						}
					}
					const val = Reflect.get(target, prop, receiver)
					return typeof val === 'function' ? val.bind(target) : val
				},
			}),
			0,
		)

		// Wait until cleanup has entered the delete phase
		while (!cleanup_started) {
			await new Promise((r) => setTimeout(r, 10))
		}

		// Instance 2 attempts to create post concurrently
		try {
			await create_post(
				db,
				alice,
				{
					content: 'Concurrent cross-instance post',
					visibility: 'public',
					imageUrl: `/api/media/${distributed_key}`,
				},
				bucket,
			)
		} catch (err) {
			post_error = err
		}

		await cleanup_promise

		// Since cleanup deleted the object under lock, the concurrent post creation safely aborted
		expect(post_error).toBeDefined()
		// And DB is clean - no dangling post exists referencing the deleted object
		expect(await is_media_referenced(db, distributed_key)).toBe(false)
	})

	it('safely recovers truly stale abandoned locks via atomic CAS', async () => {
		const stale_key = 'stale-abandoned.jpg'
		const abandoned_owner = 'crashed-worker-uuid'
		const ancient_time = Date.now() - 45_000 // older than 30s TTL

		await db.insert(media_cleanup_lock).values({
			key: stale_key,
			lockedAt: ancient_time,
			owner: abandoned_owner,
		})

		let executed = false
		await with_media_lock(db, stale_key, async ({ is_valid }) => {
			expect(await is_valid()).toBe(true)
			executed = true
		})

		expect(executed).toBe(true)
		// Lock is deleted upon release
		const [remaining] = await db
			.select()
			.from(media_cleanup_lock)
			.where(eq(media_cleanup_lock.key, stale_key))
			.limit(1)
		expect(remaining).toBeUndefined()
	})

	it('heartbeat continuously renews active lock so concurrent workers cannot steal it', async () => {
		const busy_key = 'busy-long-running.jpg'

		let worker_a_running = true

		// Worker A starts an operation
		const worker_a_promise = with_media_lock(db, busy_key, async () => {
			while (worker_a_running) {
				await new Promise((r) => setTimeout(r, 20))
			}
		})

		// Give Worker A time to acquire lock
		await new Promise((r) => setTimeout(r, 60))

		// Check the DB lock table: Worker A holds the lock
		const [entry] = await db
			.select()
			.from(media_cleanup_lock)
			.where(eq(media_cleanup_lock.key, busy_key))
			.limit(1)

		expect(entry).toBeDefined()
		expect(Date.now() - entry.lockedAt).toBeLessThan(30_000)

		// Attempting atomic CAS steal from Worker B fails because lock is active
		const cas_steal = await db
			.update(media_cleanup_lock)
			.set({ lockedAt: Date.now(), owner: 'worker-b' })
			.where(
				and(
					eq(media_cleanup_lock.key, busy_key),
					eq(media_cleanup_lock.owner, entry.owner),
					eq(media_cleanup_lock.lockedAt, entry.lockedAt),
					lt(media_cleanup_lock.lockedAt, Date.now() - 30_000),
				),
			)
			.returning()

		// CAS steal was rejected
		expect(cas_steal).toHaveLength(0)

		worker_a_running = false
		await worker_a_promise

		// After Worker A finishes, lock is cleanly removed
		const [after] = await db
			.select()
			.from(media_cleanup_lock)
			.where(eq(media_cleanup_lock.key, busy_key))
			.limit(1)
		expect(after).toBeUndefined()
	})
})
