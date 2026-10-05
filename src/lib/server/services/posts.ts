import { and, desc, eq, gte, lt, ne, or, sql, type SQL } from 'drizzle-orm'
import { error } from '@sveltejs/kit'
import type { Db } from '../db'
import { bookmark, comment, follow, like, post, user } from '../db/schema'
import { MAX_POST_LENGTH, MAX_TRENDING_LIMIT, TRENDING_SCAN_LIMIT } from '$lib/limits'
import type { Page, PostView, TrendingPeriod } from '$lib/types'
import { clamp_limit, decode_cursor, encode_cursor, like_pattern, new_id } from './cursor'
import { with_media_lock } from './media'
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
export function visible_to(viewer_id: string): SQL {
	return sql`(${post.visibility} = 'public'
		or ${post.userId} = ${viewer_id}
		or exists (select 1 from ${follow} where ${follow.followerId} = ${viewer_id} and ${follow.followingId} = ${post.userId}))`
}

const post_columns = (viewer_id: string) => ({
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
	liked_by_me: sql<number>`exists(select 1 from ${like} where ${like.postId} = ${post.id} and ${like.userId} = ${viewer_id})`,
	bookmarked_by_me: sql<number>`exists(select 1 from ${bookmark} where ${bookmark.postId} = ${post.id} and ${bookmark.userId} = ${viewer_id})`,
})

type PostRow = Awaited<ReturnType<typeof select_posts>>[number]

function select_posts(db: Db, viewer_id: string, where: SQL | undefined, limit: number) {
	return db
		.select(post_columns(viewer_id))
		.from(post)
		.innerJoin(user, eq(user.id, post.userId))
		.where(where)
		.orderBy(desc(post.createdAt), desc(post.id))
		.limit(limit)
}

function to_post_view(row: PostRow, viewer_id: string): PostView {
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
		bookmarked_by_me: Boolean(row.bookmarked_by_me),
		is_owner: viewer_id === row.user_id,
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
	viewer_id: string,
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
	input: { content?: unknown; visibility?: unknown; imageUrl?: unknown },
	bucket?: R2Bucket,
): Promise<PostView> {
	const visibility = parse_visibility(input.visibility)

	let image_url: string | null = null
	let r2_key: string | null = null
	if (input.imageUrl !== undefined && input.imageUrl !== null) {
		if (typeof input.imageUrl !== 'string') error(400, 'imageUrl must be a string')
		const trimmed = input.imageUrl.trim()
		if (trimmed.length > 0) {
			const match = trimmed.match(/^\/api\/media\/([a-zA-Z0-9_-]+\.[a-z0-9]+)(?:\?.*)?$/)
			if (!match) {
				error(400, 'Invalid imageUrl')
			}
			r2_key = match[1]
			image_url = trimmed
		}
	}

	let content = ''
	if (typeof input.content === 'string') {
		content = input.content.trim()
	}
	if (content.length > MAX_POST_LENGTH) {
		error(400, `Post must be at most ${MAX_POST_LENGTH} characters`)
	}
	if (content.length === 0 && !image_url) {
		error(400, 'Post must not be empty')
	}

	const id = new_id()
	const now = new Date()

	const execute_create = async () => {
		if (r2_key) {
			if (bucket) {
				const head = await bucket.head(r2_key)
				if (!head) {
					error(400, 'Media not found')
				}
				if (head.customMetadata?.userId && head.customMetadata.userId !== user_id) {
					error(403, 'Media does not belong to user')
				}
			}

			// Ensure media key is not already attached to another post
			const query_prefix = `/api/media/${r2_key}?`
			const existing = await db
				.select({ id: post.id })
				.from(post)
				.where(
					or(
						eq(post.imageUrl, `/api/media/${r2_key}`),
						sql`instr(${post.imageUrl}, ${query_prefix}) = 1`,
					),
				)
				.limit(1)
			if (existing.length > 0) {
				error(400, 'Media is already attached to another post')
			}
		}

		try {
			await db.insert(post).values({
				id,
				userId: user_id,
				content,
				visibility,
				imageUrl: image_url,
				createdAt: now,
				updatedAt: now,
			})

			if (bucket && r2_key) {
				const head = await bucket.head(r2_key)
				if (!head) {
					await db.delete(post).where(eq(post.id, id))
					error(400, 'Media not found')
				}
			}
		} catch (err) {
			if (bucket && r2_key) {
				try {
					await bucket.delete(r2_key)
				} catch {
					// Non-fatal cleanup failure
				}
			}
			throw err
		}
	}

	if (r2_key) {
		await with_media_lock(db, r2_key, execute_create)
	} else {
		await execute_create()
	}
	return await get_post_or_404(db, user_id, id)
}

export function list_feed(
	db: Db,
	viewer_id: string,
	opts: { cursor?: string | null; limit?: number; feed?: 'global' | 'following' } = {},
) {
	if (opts.feed === 'following') {
		const following_filter = sql<boolean>`(${post.userId} = ${viewer_id} or exists (select 1 from ${follow} where ${follow.followerId} = ${viewer_id} and ${follow.followingId} = ${post.userId}))`
		return paginate(db, viewer_id, [following_filter], opts)
	}
	return paginate(db, viewer_id, [eq(post.visibility, 'public')], opts)
}

export function list_posts_by_user(
	db: Db,
	viewer_id: string,
	author_id: string,
	opts: { cursor?: string | null; limit?: number } = {},
) {
	return paginate(db, viewer_id, [eq(post.userId, author_id)], opts)
}

/**
 * The viewer's own liked or bookmarked posts, newest like/bookmark first (not newest post
 * first), so the cursor is keyed on the like/bookmark time. Posts the viewer can no longer
 * read (e.g. they unfollowed a followers-only author) are left out.
 */
async function list_collected(
	db: Db,
	viewer_id: string,
	collection: typeof like | typeof bookmark,
	opts: { cursor?: string | null; limit?: number },
): Promise<Page<PostView>> {
	const limit = clamp_limit(opts.limit)
	const cursor = decode_cursor(opts.cursor)
	const rows = await db
		.select({ ...post_columns(viewer_id), collected_at: collection.createdAt })
		.from(collection)
		.innerJoin(post, eq(post.id, collection.postId))
		.innerJoin(user, eq(user.id, post.userId))
		.where(
			and(
				eq(collection.userId, viewer_id),
				visible_to(viewer_id),
				cursor
					? or(
							lt(collection.createdAt, cursor.date),
							and(eq(collection.createdAt, cursor.date), lt(post.id, cursor.id)),
						)
					: undefined,
			),
		)
		.orderBy(desc(collection.createdAt), desc(post.id))
		.limit(limit + 1)
	const has_more = rows.length > limit
	const page = has_more ? rows.slice(0, limit) : rows
	const last = page.at(-1)
	return {
		items: page.map((row) => to_post_view(row, viewer_id)),
		next_cursor: has_more && last ? encode_cursor(last.collected_at, last.id) : null,
	}
}

export const list_liked_posts = (
	db: Db,
	viewer_id: string,
	opts: { cursor?: string | null; limit?: number } = {},
) => list_collected(db, viewer_id, like, opts)

export const list_bookmarked_posts = (
	db: Db,
	viewer_id: string,
	opts: { cursor?: string | null; limit?: number } = {},
) => list_collected(db, viewer_id, bookmark, opts)

/**
 * Design note: search is a case-insensitive `LIKE '%query%'` over post content, ANDed with the
 * viewer's visibility filter. A leading-wildcard LIKE can't use an index, so each request scans
 * the posts table; the cost per request is bounded by the query-length cap (parse_query), the
 * clamped page size and keyset pagination, but still grows linearly with table size. That is
 * intentional for the expected workload (< 10k posts). At larger scale move to SQLite FTS5
 * (available on D1) or an external search service.
 */
export function search_posts(
	db: Db,
	viewer_id: string,
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
export async function get_visible_post(db: Db, viewer_id: string, post_id: string) {
	const rows = await select_posts(
		db,
		viewer_id,
		and(eq(post.id, post_id), visible_to(viewer_id)),
		1,
	)
	return rows[0] ? to_post_view(rows[0], viewer_id) : null
}

export async function get_post_or_404(db: Db, viewer_id: string, post_id: string) {
	const found = await get_visible_post(db, viewer_id, post_id)
	if (!found) error(404, 'Post not found')
	return found
}

async function require_owned_post(db: Db, user_id: string, post_id: string) {
	const row = await db
		.select({
			id: post.id,
			userId: post.userId,
			visibility: post.visibility,
			imageUrl: post.imageUrl,
			content: post.content,
		})
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
	input: { content?: unknown; visibility?: unknown; imageUrl?: unknown },
	bucket?: R2Bucket,
): Promise<PostView> {
	const owned = await require_owned_post(db, user_id, post_id)
	const changes: Partial<typeof post.$inferInsert> = { updatedAt: new Date() }

	let new_image_url = owned.imageUrl
	let new_r2_key: string | null = null
	let previous_r2_key: string | null = null
	if (owned.imageUrl) {
		const match = owned.imageUrl.match(/^\/api\/media\/([a-zA-Z0-9_-]+\.[a-z0-9]+)(?:\?.*)?$/)
		if (match) previous_r2_key = match[1]
	}

	if (input.imageUrl !== undefined) {
		if (input.imageUrl === null || input.imageUrl === '') {
			new_image_url = null
		} else if (typeof input.imageUrl === 'string') {
			const trimmed = input.imageUrl.trim()
			const match = trimmed.match(/^\/api\/media\/([a-zA-Z0-9_-]+\.[a-z0-9]+)(?:\?.*)?$/)
			if (!match) error(400, 'Invalid imageUrl')
			new_r2_key = match[1]
			new_image_url = trimmed
		} else {
			error(400, 'imageUrl must be a string')
		}
		changes.imageUrl = new_image_url
	}

	if (input.content !== undefined) {
		const text = typeof input.content === 'string' ? input.content.trim() : ''
		if (text.length > MAX_POST_LENGTH) {
			error(400, `Post must be at most ${MAX_POST_LENGTH} characters`)
		}
		if (text.length === 0 && !new_image_url) {
			error(400, 'Post must not be empty')
		}
		changes.content = text
	}

	if (input.visibility !== undefined) changes.visibility = parse_visibility(input.visibility)

	const execute_update = async () => {
		if (new_r2_key) {
			if (bucket) {
				const head = await bucket.head(new_r2_key)
				if (!head) error(400, 'Media not found')
				if (head.customMetadata?.userId && head.customMetadata.userId !== user_id) {
					error(403, 'Media does not belong to user')
				}
			}

			// Ensure media is not already attached to another post
			if (new_r2_key !== previous_r2_key) {
				const query_prefix = `/api/media/${new_r2_key}?`
				const existing = await db
					.select({ id: post.id })
					.from(post)
					.where(
						and(
							or(
								eq(post.imageUrl, `/api/media/${new_r2_key}`),
								sql`instr(${post.imageUrl}, ${query_prefix}) = 1`,
							),
							ne(post.id, post_id),
						),
					)
					.limit(1)
				if (existing.length > 0) {
					error(400, 'Media is already attached to another post')
				}
			}
		}

		await db.update(post).set(changes).where(eq(post.id, post_id))

		// Clean up previous R2 object ONLY AFTER database update succeeds
		if (bucket && previous_r2_key && previous_r2_key !== new_r2_key) {
			try {
				await bucket.delete(previous_r2_key)
			} catch {
				// Non-fatal
			}
		}
	}

	if (new_r2_key) {
		await with_media_lock(db, new_r2_key, execute_update)
	} else {
		await execute_update()
	}

	return await get_post_or_404(db, user_id, post_id)
}

/** Likes, comments and notifications are removed by ON DELETE CASCADE, not app code. */
export async function delete_post(
	db: Db,
	user_id: string,
	post_id: string,
	bucket?: R2Bucket,
): Promise<void> {
	const owned = await require_owned_post(db, user_id, post_id)
	await db.delete(post).where(eq(post.id, post_id))

	// Clean up R2 object ONLY AFTER database deletion succeeds
	if (bucket && owned.imageUrl) {
		const match = owned.imageUrl.match(/^\/api\/media\/([a-zA-Z0-9_-]+\.[a-z0-9]+)(?:\?.*)?$/)
		if (match) {
			try {
				await bucket.delete(match[1])
			} catch {
				// Non-fatal
			}
		}
	}
}

/**
 * Returns the start-of-period Date for the given trending window.
 * `today` = midnight UTC today, `week` = 7 days ago, `month` = 30 days ago.
 */
function period_start(period: TrendingPeriod): Date {
	const now = new Date()
	switch (period) {
		case 'today': {
			return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
		}
		case 'week':
			return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
		case 'month':
			return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
	}
}

export function parse_trending_period(raw: string | null | undefined): TrendingPeriod {
	if (raw === 'today' || raw === 'week' || raw === 'month') return raw
	return 'week' // sensible default
}

/**
 * Analyzes public post content and ranks top hashtags by frequency.
 *
 * Accepts a `period` parameter to restrict the time window:
 *   - `today`  – posts created since midnight UTC
 *   - `week`   – posts from the last 7 days (default)
 *   - `month`  – posts from the last 30 days
 *
 * Known limitation (intentional): trending is computed from a sample, not from every post. It
 * analyses the TRENDING_SCAN_LIMIT (500) most recent public posts that contain a `#` within the
 * chosen window and aggregates hashtags application-side. Posts without a hashtag don't count
 * against that budget, but once more than 500 hashtagged posts exist in a window, tags whose
 * posts are older than the newest 500 drop out even if still active in that window, and counts
 * are "per sampled post", not exact totals. That is acceptable for the expected workload
 * (< 10k posts); beyond that, use a materialized tag-count table or a scheduled worker.
 */
export async function get_trending_topics(
	db: Db,
	limit = 8,
	period: TrendingPeriod = 'week',
): Promise<{ tag: string; count: number }[]> {
	limit = clamp_limit(limit, 8, MAX_TRENDING_LIMIT)

	const since = period_start(period)

	const rows = await db
		.select({ content: post.content })
		.from(post)
		.where(
			and(
				sql`${post.visibility} = 'public'`,
				gte(post.createdAt, since),
				// Cheap superset of the hashtag regex below, so the scan budget is spent on posts
				// that can actually contribute a tag.
				sql`${post.content} like '%#%'`,
			),
		)
		.orderBy(desc(post.createdAt))
		.limit(TRENDING_SCAN_LIMIT)

	const counts = new Map<string, number>()
	const regex = /(#[a-zA-Z0-9_\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+)/g

	for (const row of rows) {
		const matches = row.content.match(regex)
		if (matches) {
			const unique_in_post = new Set(matches.map((m) => m.toLowerCase()))
			for (const raw_tag of unique_in_post) {
				const tag = raw_tag.startsWith('#') ? raw_tag.slice(1) : raw_tag
				if (tag.length > 0) {
					counts.set(tag, (counts.get(tag) ?? 0) + 1)
				}
			}
		}
	}

	const sorted = [...counts.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([tag, count]) => ({ tag, count }))

	return sorted.slice(0, limit)
}
