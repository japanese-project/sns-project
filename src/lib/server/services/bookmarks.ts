import { and, eq } from 'drizzle-orm'
import { error } from '@sveltejs/kit'
import type { Db } from '../db'
import { bookmark } from '../db/schema'
import { get_visible_post } from './posts'

async function require_visible_post(db: Db, user_id: string, post_id: string) {
	const visible = await get_visible_post(db, user_id, post_id)
	if (!visible) error(404, 'Post not found')
	return visible
}

/**
 * Idempotent bookmark (the primary key is user+post). Bookmarks are private to their owner:
 * no count is exposed and the author is never notified.
 */
export async function bookmark_post(db: Db, user_id: string, post_id: string) {
	await require_visible_post(db, user_id, post_id)
	await db.insert(bookmark).values({ userId: user_id, postId: post_id }).onConflictDoNothing()
	return { bookmarked: true }
}

export async function unbookmark_post(db: Db, user_id: string, post_id: string) {
	await require_visible_post(db, user_id, post_id)
	await db.delete(bookmark).where(and(eq(bookmark.userId, user_id), eq(bookmark.postId, post_id)))
	return { bookmarked: false }
}
