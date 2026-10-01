import { and, asc, eq, inArray } from 'drizzle-orm'
import { error } from '@sveltejs/kit'
import type { Db } from '../db'
import { comment, user } from '../db/schema'
import { MAX_COMMENT_LENGTH } from '$lib/limits'
import type { CommentView } from '$lib/types'
import { validate_text } from '../validation'
import { new_id } from './cursor'
import { create_notification } from './notifications'
import { get_visible_post } from './posts'
import { to_user_summary } from './users'

type CommentRow = {
	id: string
	post_id: string
	parent_id: string | null
	content: string
	created_at: Date
	user_id: string
	name: string
	username: string | null
	image: string | null
}

function to_view(row: CommentRow): CommentView {
	return {
		id: row.id,
		post_id: row.post_id,
		parent_id: row.parent_id,
		content: row.content,
		created_at: row.created_at.toISOString(),
		author: to_user_summary({
			id: row.user_id,
			name: row.name,
			username: row.username,
			image: row.image,
		}),
		replies: [],
	}
}

const columns = {
	id: comment.id,
	post_id: comment.postId,
	parent_id: comment.parentId,
	content: comment.content,
	created_at: comment.createdAt,
	user_id: comment.userId,
	name: user.name,
	username: user.username,
	image: user.image,
}

/** Comments inherit the visibility of their post: invisible post => 404, never an empty list. */
export async function list_comments(db: Db, viewer_id: string | null, post_id: string) {
	const visible = await get_visible_post(db, viewer_id, post_id)
	if (!visible) error(404, 'Post not found')

	const rows = await db
		.select(columns)
		.from(comment)
		.innerJoin(user, eq(user.id, comment.userId))
		.where(eq(comment.postId, post_id))
		.orderBy(asc(comment.createdAt), asc(comment.id))

	const top_level: CommentView[] = []
	const by_id = new Map<string, CommentView>()
	for (const row of rows) {
		const view = to_view(row)
		by_id.set(view.id, view)
		if (!row.parent_id) top_level.push(view)
	}
	for (const view of by_id.values()) {
		if (view.parent_id) by_id.get(view.parent_id)?.replies.push(view)
	}
	return top_level
}

export async function create_comment(
	db: Db,
	user_id: string,
	post_id: string,
	input: { content?: unknown; parent_id?: unknown },
): Promise<CommentView> {
	const target = await get_visible_post(db, user_id, post_id)
	if (!target) error(404, 'Post not found')
	const content = validate_text(input.content, MAX_COMMENT_LENGTH, 'Comment')

	let parent_id: string | null = null
	let parent_author_id: string | null = null
	if (input.parent_id !== undefined && input.parent_id !== null) {
		if (typeof input.parent_id !== 'string') error(400, 'parent_id must be a string')
		const parent = await db
			.select({
				id: comment.id,
				postId: comment.postId,
				parentId: comment.parentId,
				userId: comment.userId,
			})
			.from(comment)
			.where(and(eq(comment.id, input.parent_id), eq(comment.postId, post_id)))
			.get()
		if (!parent) error(400, 'Parent comment not found on this post')
		// One level only: a reply to a reply attaches to the reply's top-level comment.
		parent_id = parent.parentId ?? parent.id
		parent_author_id = parent.userId
	}

	const id = new_id()
	await db.insert(comment).values({
		id,
		postId: post_id,
		userId: user_id,
		parentId: parent_id,
		content,
		createdAt: new Date(),
		updatedAt: new Date(),
	})

	const recipients = new Set<string>([target.author.id])
	if (parent_author_id) recipients.add(parent_author_id)
	recipients.delete(user_id)
	for (const recipient_id of recipients) {
		await create_notification(db, {
			type: 'comment',
			recipient_id,
			actor_id: user_id,
			post_id,
			comment_id: id,
		})
	}

	const rows = await db
		.select(columns)
		.from(comment)
		.innerJoin(user, eq(user.id, comment.userId))
		.where(inArray(comment.id, [id]))
	return to_view(rows[0])
}
