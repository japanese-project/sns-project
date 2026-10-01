import { and, desc, eq, lt, or, sql, type SQL } from 'drizzle-orm'
import { error } from '@sveltejs/kit'
import type { Db } from '../db'
import { comment, follow, like, post, user } from '../db/schema'
import { MAX_POST_LENGTH } from '$lib/limits'
import type { Page, PostView } from '$lib/types'
import { validate_text } from '../validation'
import { clamp_limit, decode_cursor, encode_cursor, like_pattern, new_id } from './cursor'
import { to_user_summary } from './users'

export type Visibility = 'public' | 'followers-only'

export function parse_visibility(raw: unknown): Visibility {
	if (raw === undefined || raw === null) return 'public'
	if (raw === 'public' || raw === 'followers-only') return raw
	error(400, 'visibility must be "public" or "followers-only"')
}

/**
 * The single source of truth for who may read a post:
 *   public OR author = viewer OR viewer follows author
 * Every read path (feed, profile, search, single post, likes, comments) goes through this.
 */
export function visible_to(viewer_id: string | null): SQL {
	if (!viewer_id) return sql`${post.visibility} = 'public'`
	return sql`(${post.visibility} = 'public'
		or ${post.userId} = ${viewer_id}
		or exists (select 1 from ${follow} where ${follow.followerId} = ${viewer_id} and ${follow.followingId} = ${post.userId}))`
}

const post_columns = (viewer_id: string | null) => ({
	id: post.id,
	content: post.content,
	visibility: post.visibility,
	image_url: post.imageUrl,
	created_at: post.createdAt,
	user_id: post.userId,
	updated_at: post.updatedAt,
	author_name: user.name,
	author_username: user.username,
	author_image: user.image,
	like_count: sql<number>`(select count(*) from ${like} where ${like.postId} = ${post.id})`,
	comment_count: sql<number>`(select count(*) from ${comment} where ${comment.postId} = ${post.id})`,
	liked_by_me: viewer_id
		? sql<number>`exists(select 1 from ${like} where ${like.postId} = ${post.id} and ${like.userId} = ${viewer_id})`
		: sql<number>`0`,
})

type PostRow = Awaited<ReturnType<typeof select_posts>>[number]

function select_posts(db: Db, viewer_id: string | null, where: SQL | undefined, limit: number) {
	return db
		.select(post_columns(viewer_id))
		.from(post)
		.innerJoin(user, eq(user.id, post.userId))
		.where(where)
		.orderBy(desc(post.createdAt), desc(post.id))
		.limit(limit)
}

function to_post_view(row: PostRow, viewer_id: string | null): PostView {
	return {
		id: row.id,
		content: row.content,
		visibility: row.visibility,
		image_url: row.image_url,
		created_at: row.created_at.toISOString(),
		updated_at: row.updated_at.toISOString(),
		author: to_user_summary({
			id: row.user_id,
			name: row.author_name,
			username: row.author_username,
			image: row.author_image,
		}),
		like_count: Number(row.like_count),
		comment_count: Number(row.comment_count),
		liked_by_me: Boolean(row.liked_by_me),
		is_owner: viewer_id !== null && viewer_id === row.user_id,
	}
}

function after_cursor(cursor: string | null | undefined): SQL | undefined {
	const decoded = decode_cursor(cursor)
	if (!decoded) return undefined
	return or(
		lt(post.createdAt, decoded.date),
		and(eq(post.createdAt, decoded.date), lt(post.id, decoded.id)),
	)
}

async function paginate(
	db: Db,
	viewer_id: string | null,
	filters: (SQL | undefined)[],
	opts: { cursor?: string | null; limit?: number },
): Promise<Page<PostView>> {
	const limit = clamp_limit(opts.limit)
	const where = and(visible_to(viewer_id), after_cursor(opts.cursor), ...filters)
	const rows = await select_posts(db, viewer_id, where, limit + 1)
	const has_more = rows.length > limit
	const page = has_more ? rows.slice(0, limit) : rows
	const last = page.at(-1)
	return {
		items: page.map((row) => to_post_view(row, viewer_id)),
		next_cursor: has_more && last ? encode_cursor(last.created_at, last.id) : null,
	}
}

export async function create_post(
	db: Db,
	user_id: string,
	input: { content?: unknown; visibility?: unknown },
): Promise<PostView> {
	const content = validate_text(input.content, MAX_POST_LENGTH, 'Post')
	const visibility = parse_visibility(input.visibility)
	const id = new_id()
	const now = new Date()
	await db.insert(post).values({
		id,
		userId: user_id,
		content,
		visibility,
		createdAt: now,
		updatedAt: now,
	})
	return await get_post_or_404(db, user_id, id)
}

export function list_feed(
	db: Db,
	viewer_id: string | null,
	opts: { cursor?: string | null; limit?: number } = {},
) {
	return paginate(db, viewer_id, [], opts)
}

export function list_posts_by_user(
	db: Db,
	viewer_id: string | null,
	author_id: string,
	opts: { cursor?: string | null; limit?: number } = {},
) {
	return paginate(db, viewer_id, [eq(post.userId, author_id)], opts)
}

export function search_posts(
	db: Db,
	viewer_id: string | null,
	query: string,
	opts: { cursor?: string | null; limit?: number } = {},
) {
	return paginate(
		db,
		viewer_id,
		[sql`lower(${post.content}) like ${like_pattern(query)} escape '\\'`],
		opts,
	)
}

/** Returns the post if the viewer may read it, otherwise null (never leaks existence). */
export async function get_visible_post(db: Db, viewer_id: string | null, post_id: string) {
	const rows = await select_posts(
		db,
		viewer_id,
		and(eq(post.id, post_id), visible_to(viewer_id)),
		1,
	)
	return rows[0] ? to_post_view(rows[0], viewer_id) : null
}

export async function get_post_or_404(db: Db, viewer_id: string | null, post_id: string) {
	const found = await get_visible_post(db, viewer_id, post_id)
	if (!found) error(404, 'Post not found')
	return found
}

async function require_owned_post(db: Db, user_id: string, post_id: string) {
	const row = await db
		.select({ id: post.id, userId: post.userId, visibility: post.visibility })
		.from(post)
		.where(eq(post.id, post_id))
		.get()
	// Hide posts the user cannot see; only then distinguish "not yours" from "not found".
	if (!row) error(404, 'Post not found')
	if (row.userId !== user_id) {
		const visible = await get_visible_post(db, user_id, post_id)
		if (!visible) error(404, 'Post not found')
		error(403, 'Only the author can modify this post')
	}
	return row
}

export async function update_post(
	db: Db,
	user_id: string,
	post_id: string,
	input: { content?: unknown; visibility?: unknown },
): Promise<PostView> {
	await require_owned_post(db, user_id, post_id)
	const content = validate_text(input.content, MAX_POST_LENGTH, 'Post')
	const changes: Partial<typeof post.$inferInsert> = { content, updatedAt: new Date() }
	if (input.visibility !== undefined) changes.visibility = parse_visibility(input.visibility)
	await db.update(post).set(changes).where(eq(post.id, post_id))
	return await get_post_or_404(db, user_id, post_id)
}

/** Likes, comments and notifications are removed by ON DELETE CASCADE, not app code. */
export async function delete_post(db: Db, user_id: string, post_id: string): Promise<void> {
	await require_owned_post(db, user_id, post_id)
	await db.delete(post).where(eq(post.id, post_id))
}
