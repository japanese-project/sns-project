import { and, eq, sql } from 'drizzle-orm'
import { error } from '@sveltejs/kit'
import type { Db } from '../db'
import { post } from '../db/schema'
import { new_id } from './cursor'
import { create_notification, remove_notification } from './notifications'
import { get_visible_post } from './posts'

async function repost_count(db: Db, post_id: string) {
	const row = await db
		.select({ n: sql<number>`count(*)` })
		.from(post)
		.where(eq(post.repostOfId, post_id))
		.get()
	return Number(row?.n ?? 0)
}

/** Reposting a repost reposts its original, so reposts are only ever one level deep. */
async function require_original(db: Db, user_id: string, post_id: string) {
	const visible = await get_visible_post(db, user_id, post_id)
	if (!visible) error(404, 'Post not found')
	return visible.repost_of ?? visible
}

/**
 * Idempotent repost: inserts an empty, public post row pointing at the original, so it shows up
 * on the reposter's profile and in their followers' following feed. The unique
 * (repost_of_id, user_id) index makes repeats a no-op.
 */
export async function repost_post(db: Db, user_id: string, post_id: string) {
	const original = await require_original(db, user_id, post_id)
	// Followers-only posts stay with the author's followers; a repost would widen the audience.
	if (original.visibility !== 'public') error(403, 'Only public posts can be reposted')
	const now = new Date()
	const inserted = await db
		.insert(post)
		.values({
			id: new_id(),
			userId: user_id,
			content: '',
			visibility: 'public',
			repostOfId: original.id,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing()
		.returning({ id: post.id })
	if (inserted.length > 0) {
		await create_notification(db, {
			type: 'repost',
			recipient_id: original.author.id,
			actor_id: user_id,
			post_id: original.id,
		})
	}
	return { reposted: true, repost_count: await repost_count(db, original.id) }
}

export async function unrepost_post(db: Db, user_id: string, post_id: string) {
	const original = await require_original(db, user_id, post_id)
	await db.delete(post).where(and(eq(post.userId, user_id), eq(post.repostOfId, original.id)))
	await remove_notification(db, `repost:${user_id}:${original.id}`)
	return { reposted: false, repost_count: await repost_count(db, original.id) }
}
