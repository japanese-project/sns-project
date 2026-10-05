import { and, desc, eq, lt, or, sql } from 'drizzle-orm'
import { error } from '@sveltejs/kit'
import type { Db } from '../db'
import { comment, notification, post, user } from '../db/schema'
import type { NotificationView, Page } from '$lib/types'
import { clamp_limit, decode_cursor, encode_cursor, new_id } from './cursor'
import { to_user_summary } from './users'

export interface NewNotification {
	type: 'like' | 'comment' | 'follow' | 'repost'
	recipient_id: string
	actor_id: string
	post_id?: string
	comment_id?: string
}

/**
 * De-duplication policy (also documented in docs/database.md):
 *  - like:    one notification per (actor, post). Unliking removes it, so like -> unlike -> like
 *             yields exactly one entry again.
 *  - repost:  one notification per (actor, post). Undoing the repost removes it.
 *  - follow:  one notification per (actor, recipient). Unfollowing removes it.
 *  - comment: one notification per comment (never de-duplicated).
 * Nobody is notified about their own actions.
 */
export async function create_notification(db: Db, input: NewNotification) {
	if (input.recipient_id === input.actor_id) return
	const dedupe_key =
		input.type === 'like' || input.type === 'repost'
			? `${input.type}:${input.actor_id}:${input.post_id}`
			: input.type === 'follow'
				? `follow:${input.actor_id}:${input.recipient_id}`
				: null
	await db
		.insert(notification)
		.values({
			id: new_id(),
			recipientId: input.recipient_id,
			actorId: input.actor_id,
			type: input.type,
			postId: input.post_id ?? null,
			commentId: input.comment_id ?? null,
			dedupeKey: dedupe_key,
			createdAt: new Date(),
		})
		.onConflictDoNothing()
}

export async function remove_notification(db: Db, dedupe_key: string) {
	await db.delete(notification).where(eq(notification.dedupeKey, dedupe_key))
}

export async function unread_count(db: Db, user_id: string) {
	const row = await db
		.select({ n: sql<number>`count(*)` })
		.from(notification)
		.where(and(eq(notification.recipientId, user_id), eq(notification.read, false)))
		.get()
	return Number(row?.n ?? 0)
}

function snippet(text: string | null) {
	if (!text) return null
	return text.length > 80 ? `${text.slice(0, 77)}...` : text
}

export async function list_notifications(
	db: Db,
	user_id: string,
	opts: { cursor?: string | null; limit?: number } = {},
): Promise<Page<NotificationView>> {
	const limit = clamp_limit(opts.limit)
	const cursor = decode_cursor(opts.cursor)
	const rows = await db
		.select({
			id: notification.id,
			type: notification.type,
			read: notification.read,
			created_at: notification.createdAt,
			post_id: notification.postId,
			actor_id: user.id,
			actor_name: user.name,
			actor_username: user.username,
			actor_image: user.image,
			post_content: post.content,
			comment_content: comment.content,
		})
		.from(notification)
		.innerJoin(user, eq(user.id, notification.actorId))
		.leftJoin(post, eq(post.id, notification.postId))
		.leftJoin(comment, eq(comment.id, notification.commentId))
		.where(
			and(
				eq(notification.recipientId, user_id),
				cursor
					? or(
							lt(notification.createdAt, cursor.date),
							and(eq(notification.createdAt, cursor.date), lt(notification.id, cursor.id)),
						)
					: undefined,
			),
		)
		.orderBy(desc(notification.createdAt), desc(notification.id))
		.limit(limit + 1)

	const has_more = rows.length > limit
	const page = has_more ? rows.slice(0, limit) : rows
	const last = page.at(-1)
	return {
		items: page.map((row) => ({
			id: row.id,
			type: row.type,
			read: row.read,
			created_at: row.created_at.toISOString(),
			post_id: row.post_id,
			actor: to_user_summary({
				id: row.actor_id,
				name: row.actor_name,
				username: row.actor_username,
				image: row.actor_image,
			}),
			snippet: snippet(row.type === 'comment' ? row.comment_content : row.post_content),
		})),
		next_cursor: has_more && last ? encode_cursor(last.created_at, last.id) : null,
	}
}

/** Marks one notification (by id) or all of the user's notifications as read. Owner-only. */
export async function mark_read(db: Db, user_id: string, notification_id?: string) {
	if (notification_id) {
		const updated = await db
			.update(notification)
			.set({ read: true })
			.where(and(eq(notification.id, notification_id), eq(notification.recipientId, user_id)))
			.returning({ id: notification.id })
		if (updated.length === 0) error(404, 'Notification not found')
	} else {
		await db
			.update(notification)
			.set({ read: true })
			.where(and(eq(notification.recipientId, user_id), eq(notification.read, false)))
	}
	return { unread_count: await unread_count(db, user_id) }
}
