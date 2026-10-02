import { and, eq, sql } from 'drizzle-orm'
import { error } from '@sveltejs/kit'
import type { Db } from '../db'
import { like } from '../db/schema'
import { create_notification, remove_notification } from './notifications'
import { get_visible_post } from './posts'

async function like_count(db: Db, post_id: string) {
	const row = await db
		.select({ n: sql<number>`count(*)` })
		.from(like)
		.where(eq(like.postId, post_id))
		.get()
	return Number(row?.n ?? 0)
}

async function require_visible_post(db: Db, user_id: string, post_id: string) {
	const visible = await get_visible_post(db, user_id, post_id)
	if (!visible) error(404, 'Post not found')
	return visible
}

/** Idempotent like using INSERT ... ON CONFLICT DO NOTHING (the primary key is user+post). */
export async function like_post(db: Db, user_id: string, post_id: string) {
	const target = await require_visible_post(db, user_id, post_id)
	const inserted = await db
		.insert(like)
		.values({ userId: user_id, postId: post_id })
		.onConflictDoNothing()
		.returning({ id: like.postId })
	if (inserted.length > 0 && target.author.id !== user_id) {
		await create_notification(db, {
			type: 'like',
			recipient_id: target.author.id,
			actor_id: user_id,
			post_id,
		})
	}
	return { liked: true, like_count: await like_count(db, post_id) }
}

export async function unlike_post(db: Db, user_id: string, post_id: string) {
	await require_visible_post(db, user_id, post_id)
	await db.delete(like).where(and(eq(like.userId, user_id), eq(like.postId, post_id)))
	await remove_notification(db, `like:${user_id}:${post_id}`)
	return { liked: false, like_count: await like_count(db, post_id) }
}
