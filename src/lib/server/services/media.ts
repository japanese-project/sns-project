import { isNotNull } from 'drizzle-orm'
import type { Db } from '../db'
import { post } from '../db/schema'

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
		const key = url.slice('/api/media/'.length)
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
 * Deletes orphaned media files from R2 storage.
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
		await media_bucket.delete(item.key)
		deleted_keys.push(item.key)
		reclaimed_bytes += item.size
	}

	return {
		deleted_count: deleted_keys.length,
		reclaimed_bytes,
		deleted_keys,
	}
}
