import { and, desc, eq, lt, or, sql } from 'drizzle-orm'
import { error } from '@sveltejs/kit'
import type { Db } from '../db'
import { follow, user } from '../db/schema'
import type { Page, ProfileView, UserListItem } from '$lib/types'
import { clamp_limit, decode_cursor, encode_cursor } from './cursor'
import { create_notification, remove_notification } from './notifications'
import { to_user_summary } from './users'

export async function is_following(db: Db, follower_id: string, following_id: string) {
	const row = await db
		.select({ n: sql<number>`1` })
		.from(follow)
		.where(and(eq(follow.followerId, follower_id), eq(follow.followingId, following_id)))
		.get()
	return row !== undefined
}

async function counts(db: Db, user_id: string) {
	const [followers, following] = await Promise.all([
		db
			.select({ n: sql<number>`count(*)` })
			.from(follow)
			.where(eq(follow.followingId, user_id))
			.get(),
		db
			.select({ n: sql<number>`count(*)` })
			.from(follow)
			.where(eq(follow.followerId, user_id))
			.get(),
	])
	return { follower_count: Number(followers?.n ?? 0), following_count: Number(following?.n ?? 0) }
}

export async function build_profile(
	db: Db,
	viewer_id: string | null,
	target: {
		id: string
		name: string
		username: string | null
		image: string | null
		createdAt: Date
	},
): Promise<ProfileView> {
	return {
		user: to_user_summary(target),
		joined_at: target.createdAt.toISOString(),
		...(await counts(db, target.id)),
		is_self: viewer_id === target.id,
		is_following:
			viewer_id && viewer_id !== target.id ? await is_following(db, viewer_id, target.id) : false,
	}
}

/** Idempotent: following someone you already follow is a no-op, never a duplicate row. */
export async function follow_user(db: Db, follower_id: string, target_id: string) {
	if (follower_id === target_id) error(400, 'You cannot follow yourself')
	const target = await db.select({ id: user.id }).from(user).where(eq(user.id, target_id)).get()
	if (!target) error(404, 'User not found')

	const inserted = await db
		.insert(follow)
		.values({ followerId: follower_id, followingId: target_id })
		.onConflictDoNothing()
		.returning({ id: follow.followerId })
	if (inserted.length > 0) {
		await create_notification(db, {
			type: 'follow',
			recipient_id: target_id,
			actor_id: follower_id,
		})
	}
	return { following: true, ...(await counts(db, target_id)) }
}

export async function unfollow_user(db: Db, follower_id: string, target_id: string) {
	if (follower_id === target_id) error(400, 'You cannot unfollow yourself')
	await db
		.delete(follow)
		.where(and(eq(follow.followerId, follower_id), eq(follow.followingId, target_id)))
	await remove_notification(db, `follow:${follower_id}:${target_id}`)
	return { following: false, ...(await counts(db, target_id)) }
}

async function list_related(
	db: Db,
	viewer_id: string | null,
	user_id: string,
	direction: 'followers' | 'following',
	opts: { cursor?: string | null; limit?: number },
): Promise<Page<UserListItem>> {
	const limit = clamp_limit(opts.limit)
	const owner_column = direction === 'followers' ? follow.followingId : follow.followerId
	const other_column = direction === 'followers' ? follow.followerId : follow.followingId
	const cursor = decode_cursor(opts.cursor)

	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			username: user.username,
			image: user.image,
			followed_at: follow.createdAt,
			is_following: viewer_id
				? sql<number>`exists(select 1 from ${follow} f2 where f2.follower_id = ${viewer_id} and f2.following_id = ${user.id})`
				: sql<number>`0`,
		})
		.from(follow)
		.innerJoin(user, eq(user.id, other_column))
		.where(
			and(
				eq(owner_column, user_id),
				cursor
					? or(
							lt(follow.createdAt, cursor.date),
							and(eq(follow.createdAt, cursor.date), lt(user.id, cursor.id)),
						)
					: undefined,
			),
		)
		.orderBy(desc(follow.createdAt), desc(user.id))
		.limit(limit + 1)

	const has_more = rows.length > limit
	const page = has_more ? rows.slice(0, limit) : rows
	const last = page.at(-1)
	return {
		items: page.map((row) => ({
			...to_user_summary(row),
			is_following: Boolean(row.is_following),
			is_self: viewer_id === row.id,
		})),
		next_cursor: has_more && last ? encode_cursor(last.followed_at, last.id) : null,
	}
}

export const list_followers = (
	db: Db,
	viewer_id: string | null,
	user_id: string,
	opts: { cursor?: string | null; limit?: number } = {},
) => list_related(db, viewer_id, user_id, 'followers', opts)

export const list_following = (
	db: Db,
	viewer_id: string | null,
	user_id: string,
	opts: { cursor?: string | null; limit?: number } = {},
) => list_related(db, viewer_id, user_id, 'following', opts)
