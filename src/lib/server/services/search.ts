import { and, asc, sql } from 'drizzle-orm'
import { error } from '@sveltejs/kit'
import type { Db } from '../db'
import { follow, user } from '../db/schema'
import { MAX_SEARCH_LENGTH } from '$lib/limits'
import type { PostView, UserListItem } from '$lib/types'
import { clamp_limit, like_pattern } from './cursor'
import { search_posts } from './posts'
import { to_user_summary } from './users'

export function parse_query(raw: string | null | undefined): string {
	const query = (raw ?? '').trim()
	if (query.length === 0) error(400, 'Search query must not be empty')
	if (query.length > MAX_SEARCH_LENGTH)
		error(400, `Search query must be at most ${MAX_SEARCH_LENGTH} characters`)
	return query
}

export async function search_users(
	db: Db,
	viewer_id: string | null,
	query: string,
	limit?: number,
): Promise<UserListItem[]> {
	const pattern = like_pattern(query.replace(/^@/, ''))
	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			username: user.username,
			image: user.image,
			is_following: viewer_id
				? sql<number>`exists(select 1 from ${follow} where ${follow.followerId} = ${viewer_id} and ${follow.followingId} = ${user.id})`
				: sql<number>`0`,
		})
		.from(user)
		.where(
			and(
				sql`(lower(${user.username}) like ${pattern} escape '\\' or lower(${user.name}) like ${pattern} escape '\\')`,
			),
		)
		.orderBy(asc(user.username), asc(user.id))
		.limit(clamp_limit(limit))
	return rows.map((row) => ({
		...to_user_summary(row),
		is_following: Boolean(row.is_following),
		is_self: viewer_id === row.id,
	}))
}

export async function search_all(
	db: Db,
	viewer_id: string | null,
	query: string,
	opts: { cursor?: string | null; limit?: number } = {},
): Promise<{ users: UserListItem[]; posts: PostView[]; next_cursor: string | null }> {
	const [users, posts] = await Promise.all([
		opts.cursor ? Promise.resolve([]) : search_users(db, viewer_id, query, 10),
		search_posts(db, viewer_id, query, opts),
	])
	return { users, posts: posts.items, next_cursor: posts.next_cursor }
}
