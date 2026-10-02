import { and, eq, isNotNull, like, lt, or } from 'drizzle-orm'
import type { Db } from '../db'
import { media_cleanup_lock, post } from '../db/schema'

export interface MediaStorageStats {
	total_objects: number
	total_bytes: number
	referenced_objects: number
	orphaned_objects: number
	orphaned_bytes: number
}

export interface OrphanedMediaInfo {
	key: string
	size: number
	uploaded_at: number
}

export interface CleanupResult {
	deleted_count: number
	reclaimed_bytes: number
	deleted_keys: string[]
}

export function get_r2_key_from_url(url: string): string | null {
	if (url.startsWith('/api/media/')) {
		let key = url.slice('/api/media/'.length)
		const query_idx = key.indexOf('?')
		if (query_idx !== -1) {
			key = key.slice(0, query_idx)
		}
		return key.includes('/') ? null : key
	}
	return null
}

async function list_all_bucket_objects(media_bucket: R2Bucket): Promise<R2Object[]> {
	const all_objects: R2Object[] = []
	let cursor: string | undefined = undefined
	let truncated = true

	while (truncated) {
		const list = await media_bucket.list({ cursor, limit: 1000 })
		all_objects.push(...list.objects)
		truncated = list.truncated
		if (truncated && 'cursor' in list && typeof list.cursor === 'string') {
			cursor = list.cursor
		} else {
			break
		}
	}

	return all_objects
}

async function get_all_referenced_keys(db: Db): Promise<Set<string>> {
	const rows = await db
		.select({ imageUrl: post.imageUrl })
		.from(post)
		.where(isNotNull(post.imageUrl))
		.all()

	const referenced = new Set<string>()
	for (const row of rows) {
		if (row.imageUrl) {
			const key = get_r2_key_from_url(row.imageUrl)
			if (key) referenced.add(key)
		}
	}
	return referenced
}

/**
 * Returns overall media storage metrics and lifecycle information.
 */
export async function get_storage_stats(
	db: Db,
	media_bucket: R2Bucket,
): Promise<MediaStorageStats> {
	const [objects, referenced_keys] = await Promise.all([
		list_all_bucket_objects(media_bucket),
		get_all_referenced_keys(db),
	])

	let total_bytes = 0
	let orphaned_objects = 0
	let orphaned_bytes = 0
	let referenced_objects = 0

	for (const obj of objects) {
		total_bytes += obj.size
		if (referenced_keys.has(obj.key)) {
			referenced_objects++
		} else {
			orphaned_objects++
			orphaned_bytes += obj.size
		}
	}

	return {
		total_objects: objects.length,
		total_bytes,
		referenced_objects,
		orphaned_objects,
		orphaned_bytes,
	}
}

/**
 * Identifies media files in R2 storage that are no longer referenced by any post in the database.
 * If older_than_ms > 0, skips recently uploaded files to avoid racing in-flight posts.
 */
export async function identify_orphaned_media(
	db: Db,
	media_bucket: R2Bucket,
	older_than_ms: number = 60 * 60 * 1000,
): Promise<OrphanedMediaInfo[]> {
	const [objects, referenced_keys] = await Promise.all([
		list_all_bucket_objects(media_bucket),
		get_all_referenced_keys(db),
	])

	const cutoff = Date.now() - older_than_ms
	const orphaned: OrphanedMediaInfo[] = []

	for (const obj of objects) {
		if (!referenced_keys.has(obj.key)) {
			const uploaded_time = obj.uploaded ? new Date(obj.uploaded).getTime() : 0
			if (older_than_ms === 0 || uploaded_time <= cutoff) {
				orphaned.push({
					key: obj.key,
					size: obj.size,
					uploaded_at: uploaded_time,
				})
			}
		}
	}

	return orphaned
}

/**
 * Per-key async mutex to eliminate TOCTOU races between concurrent post attachment
 * and media cleanup deletions.
 */
class KeyedMutex {
	private locks = new Map<string, Promise<void>>()

	async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
		while (this.locks.has(key)) {
			await this.locks.get(key)
		}
		let resolve!: () => void
		const promise = new Promise<void>((r) => {
			resolve = r
		})
		this.locks.set(key, promise)
		try {
			return await fn()
		} finally {
			this.locks.delete(key)
			resolve()
		}
	}
}

export const media_lock = new KeyedMutex()

const lock_ttl_ms = 30_000
const heartbeat_interval_ms = 5_000
const max_lock_wait_ms = 4_000

export interface MediaLockContext {
	is_valid: () => Promise<boolean>
}

/**
 * Distributed media lock that coordinates orphan cleanup and post creation/updates
 * across multiple worker instances and server processes using D1 database-level locking,
 * backed by an in-memory KeyedMutex for local efficiency.
 *
 * Implements atomic CAS stale-lock takeover and periodic heartbeat renewals to guarantee
 * active cleanup operations cannot be preempted even if running longer than the TTL.
 */
export async function with_media_lock<T>(
	db: Db,
	key: string,
	fn: (ctx: MediaLockContext) => Promise<T>,
): Promise<T> {
	return await media_lock.run(key, async () => {
		const owner = crypto.randomUUID()
		const start_time = Date.now()

		// Acquire distributed DB lock
		while (true) {
			const now = Date.now()
			try {
				await db.insert(media_cleanup_lock).values({
					key,
					lockedAt: now,
					owner,
				})
				break
			} catch {
				// Lock entry exists; check if it has expired (stale lock recovery)
				const [existing] = await db
					.select()
					.from(media_cleanup_lock)
					.where(eq(media_cleanup_lock.key, key))
					.limit(1)

				if (existing && now - existing.lockedAt > lock_ttl_ms) {
					// Atomic CAS stale-lock takeover: update ONLY if key, owner, and lockedAt
					// match the observed stale state and lockedAt is strictly older than lock_ttl_ms
					const updated = await db
						.update(media_cleanup_lock)
						.set({ lockedAt: now, owner })
						.where(
							and(
								eq(media_cleanup_lock.key, key),
								eq(media_cleanup_lock.owner, existing.owner),
								eq(media_cleanup_lock.lockedAt, existing.lockedAt),
								lt(media_cleanup_lock.lockedAt, now - lock_ttl_ms),
							),
						)
						.returning()

					if (updated.length > 0) {
						break // Atomic CAS takeover succeeded
					}
				}

				if (Date.now() - start_time > max_lock_wait_ms) {
					throw new Error(`Timeout waiting for media lock on ${key}`)
				}

				await new Promise((resolve) => setTimeout(resolve, 30))
			}
		}

		// Active lease keep-alive heartbeat: periodically renew lockedAt
		// so active long-running operations are never misidentified as stale
		const heartbeat_timer = setInterval(async () => {
			try {
				await db
					.update(media_cleanup_lock)
					.set({ lockedAt: Date.now() })
					.where(and(eq(media_cleanup_lock.key, key), eq(media_cleanup_lock.owner, owner)))
			} catch {
				// Ignore transient heartbeat error
			}
		}, heartbeat_interval_ms)

		const is_valid = async () => {
			const [current] = await db
				.select({ owner: media_cleanup_lock.owner })
				.from(media_cleanup_lock)
				.where(eq(media_cleanup_lock.key, key))
				.limit(1)
			return current?.owner === owner
		}

		try {
			return await fn({ is_valid })
		} finally {
			clearInterval(heartbeat_timer)
			try {
				await db
					.delete(media_cleanup_lock)
					.where(and(eq(media_cleanup_lock.key, key), eq(media_cleanup_lock.owner, owner)))
			} catch {
				// Non-fatal cleanup
			}
		}
	})
}

/**
 * Checks whether an R2 key is currently referenced by any post in the database.
 */
export async function is_media_referenced(db: Db, key: string): Promise<boolean> {
	const exact_url = `/api/media/${key}`
	const prefix = `/api/media/${key}?`
	const rows = await db
		.select({ id: post.id })
		.from(post)
		.where(or(eq(post.imageUrl, exact_url), like(post.imageUrl, `${prefix}%`)))
		.limit(1)
	return rows.length > 0
}

/**
 * Deletes orphaned media files from R2 storage.
 * Synchronizes with post creation/update using `media_lock` and re-checks post references
 * under the lock immediately before deletion to prevent TOCTOU races.
 */
export async function cleanup_orphaned_media(
	db: Db,
	media_bucket: R2Bucket,
	older_than_ms: number = 60 * 60 * 1000,
): Promise<CleanupResult> {
	const orphaned = await identify_orphaned_media(db, media_bucket, older_than_ms)
	const deleted_keys: string[] = []
	let reclaimed_bytes = 0

	for (const item of orphaned) {
		await with_media_lock(db, item.key, async ({ is_valid }) => {
			// Re-check reference immediately before deletion under the lock to prevent TOCTOU races
			const referenced = await is_media_referenced(db, item.key)
			if (referenced) {
				return
			}

			// Verify lock ownership is still valid before executing permanent R2 deletion
			if (!(await is_valid())) {
				return
			}

			await media_bucket.delete(item.key)
			deleted_keys.push(item.key)
			reclaimed_bytes += item.size
		})
	}

	return {
		deleted_count: deleted_keys.length,
		reclaimed_bytes,
		deleted_keys,
	}
}
