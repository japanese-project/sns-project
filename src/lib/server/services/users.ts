import { and, desc, eq, isNull, ne, or, sql } from 'drizzle-orm'
import { error } from '@sveltejs/kit'
import type { Db } from '../db'
import { follow, user } from '../db/schema'
import { MAX_BIO_LENGTH, MAX_NAME_LENGTH } from '$lib/limits'
import type { UserListItem, UserSummary } from '$lib/types'

export function to_user_summary(row: {
	id: string
	name: string
	username: string | null
	image: string | null
	bio?: string | null
}): UserSummary {
	return {
		id: row.id,
		name: row.name,
		username: row.username,
		handle: row.username ?? row.id,
		image: row.image,
		bio: row.bio ?? null,
	}
}

export function username_from_email(email: string): string {
	const local = email.split('@')[0] ?? ''
	const cleaned = local
		.toLowerCase()
		.replace(/[^a-z0-9_]/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 20)
	return cleaned.length > 0 ? cleaned : 'user'
}

/**
 * Returns the user's username, assigning one (derived from their email, made unique with a
 * numeric suffix) if they don't have one yet. Safe to call repeatedly.
 */
export async function ensure_username(db: Db, user_id: string, email: string): Promise<string> {
	const existing = await db
		.select({ username: user.username })
		.from(user)
		.where(eq(user.id, user_id))
		.get()
	if (existing?.username) return existing.username

	const base = username_from_email(email)
	for (let attempt = 0; attempt < 8; attempt++) {
		const candidate = attempt === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`
		try {
			const updated = await db
				.update(user)
				.set({ username: candidate })
				.where(and(eq(user.id, user_id), isNull(user.username)))
				.returning({ username: user.username })
			if (updated[0]) return updated[0].username!
			// Lost a race with another request that assigned one.
			const current = await db
				.select({ username: user.username })
				.from(user)
				.where(eq(user.id, user_id))
				.get()
			if (current?.username) return current.username
		} catch {
			// UNIQUE violation: try again with a suffix.
		}
	}
	return user_id
}

/** Looks a user up by username (case-insensitive) or, for users without one, by id. */
export async function find_user_by_handle(db: Db, handle: string) {
	const row = await db
		.select({
			id: user.id,
			name: user.name,
			username: user.username,
			image: user.image,
			bio: user.bio,
			interests: user.interests,
			onboarded: user.onboarded,
			createdAt: user.createdAt,
		})
		.from(user)
		.where(or(eq(user.username, handle.toLowerCase()), eq(user.id, handle)))
		.get()
	return row ?? null
}

export async function require_user_by_handle(db: Db, handle: string) {
	const row = await find_user_by_handle(db, handle)
	if (!row) error(404, 'User not found')
	return row
}

export async function update_user_profile(
	db: Db,
	user_id: string,
	input: {
		name?: unknown
		username?: unknown
		bio?: unknown
		interests?: unknown
	},
) {
	const current = await db.select().from(user).where(eq(user.id, user_id)).get()
	if (!current) error(404, 'User not found')

	let next_name = current.name
	if (input.name !== undefined) {
		const raw_name = String(input.name).trim()
		if (raw_name.length === 0 || raw_name.length > MAX_NAME_LENGTH) {
			error(400, `Name must be between 1 and ${MAX_NAME_LENGTH} characters`)
		}
		next_name = raw_name
	}

	let next_username = current.username
	if (input.username !== undefined && input.username !== null && input.username !== '') {
		const candidate = String(input.username).trim().toLowerCase()
		if (!/^[a-z0-9_]{3,30}$/.test(candidate)) {
			error(
				400,
				'Username must be 3–30 characters and contain only lowercase letters, numbers, and underscores',
			)
		}
		const existing = await db
			.select({ id: user.id })
			.from(user)
			.where(and(eq(user.username, candidate), ne(user.id, user_id)))
			.get()
		if (existing) {
			error(400, 'Username is already taken')
		}
		next_username = candidate
	}

	let next_bio = current.bio
	if (input.bio !== undefined) {
		const raw_bio = input.bio === null ? null : String(input.bio).trim()
		if (raw_bio && raw_bio.length > MAX_BIO_LENGTH) {
			error(400, `Bio must be at most ${MAX_BIO_LENGTH} characters`)
		}
		next_bio = raw_bio && raw_bio.length > 0 ? raw_bio : null
	}

	let next_interests = current.interests
	if (Array.isArray(input.interests)) {
		const valid = (input.interests as unknown[]).filter((i) => typeof i === 'string').slice(0, 10)
		next_interests = JSON.stringify(valid)
	}

	const now = new Date()
	await db
		.update(user)
		.set({
			name: next_name,
			username: next_username,
			bio: next_bio,
			interests: next_interests,
			updatedAt: now,
		})
		.where(eq(user.id, user_id))

	return {
		id: user_id,
		name: next_name,
		username: next_username,
		handle: next_username ?? user_id,
		bio: next_bio,
		interests: next_interests,
		image: current.image,
	}
}

export async function complete_onboarding(
	db: Db,
	user_id: string,
	input: {
		name?: unknown
		username?: unknown
		bio?: unknown
		interests?: unknown
		skip?: boolean
	},
) {
	if (input.skip) {
		await db
			.update(user)
			.set({ onboarded: true, updatedAt: new Date() })
			.where(eq(user.id, user_id))
		return { onboarded: true }
	}
	if (input.name !== undefined || input.username !== undefined || input.bio !== undefined) {
		await update_user_profile(db, user_id, {
			name: input.name,
			username: input.username,
			bio: input.bio,
		})
	}
	let interests_json: string | null = null
	if (Array.isArray(input.interests)) {
		const valid = input.interests.filter((i) => typeof i === 'string').slice(0, 10)
		interests_json = JSON.stringify(valid)
	}
	await db
		.update(user)
		.set({
			onboarded: true,
			interests: interests_json,
			updatedAt: new Date(),
		})
		.where(eq(user.id, user_id))
	return { onboarded: true, interests: interests_json }
}

export async function get_suggested_users(
	db: Db,
	viewer_id: string | null,
	limit = 5,
): Promise<UserListItem[]> {
	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			username: user.username,
			image: user.image,
			bio: user.bio,
			is_following: viewer_id
				? sql<number>`exists(select 1 from ${follow} where ${follow.followerId} = ${viewer_id} and ${follow.followingId} = ${user.id})`
				: sql<number>`0`,
			is_followed_by: viewer_id
				? sql<number>`exists(select 1 from ${follow} where ${follow.followerId} = ${user.id} and ${follow.followingId} = ${viewer_id})`
				: sql<number>`0`,
		})
		.from(user)
		.where(
			viewer_id
				? and(
						ne(user.id, viewer_id),
						sql`not exists(select 1 from ${follow} where ${follow.followerId} = ${viewer_id} and ${follow.followingId} = ${user.id})`,
					)
				: undefined,
		)
		.orderBy(desc(user.createdAt))
		.limit(limit)

	return rows.map((row) => ({
		...to_user_summary(row),
		is_following: Boolean(row.is_following),
		is_followed_by: Boolean(row.is_followed_by),
		is_self: viewer_id === row.id,
	}))
}

/**
 * Returns up to `limit` users (not self, not already followed) who share at least one interest
 * from the provided list. Falls back to recent users if no interests given.
 */
export async function get_users_by_interests(
	db: Db,
	viewer_id: string | null,
	interests: string[],
	limit = 5,
): Promise<UserListItem[]> {
	if (interests.length === 0) return get_suggested_users(db, viewer_id, limit)

	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			username: user.username,
			image: user.image,
			bio: user.bio,
			interests: user.interests,
			is_following: viewer_id
				? sql<number>`exists(select 1 from ${follow} where ${follow.followerId} = ${viewer_id} and ${follow.followingId} = ${user.id})`
				: sql<number>`0`,
			is_followed_by: viewer_id
				? sql<number>`exists(select 1 from ${follow} where ${follow.followerId} = ${user.id} and ${follow.followingId} = ${viewer_id})`
				: sql<number>`0`,
		})
		.from(user)
		.where(
			viewer_id
				? and(
						ne(user.id, viewer_id),
						sql`not exists(select 1 from ${follow} where ${follow.followerId} = ${viewer_id} and ${follow.followingId} = ${user.id})`,
					)
				: undefined,
		)
		.orderBy(desc(user.createdAt))
		.limit(50) // over-fetch then filter in JS for shared interests

	// Filter to users who share at least one interest
	const lower_interests = interests.map((i) => i.toLowerCase())
	const with_shared = rows.filter((row) => {
		if (!row.interests) return false
		try {
			const their: string[] = JSON.parse(row.interests)
			return their.some((t) => lower_interests.includes(t.toLowerCase()))
		} catch {
			return false
		}
	})

	const result = with_shared.slice(0, limit)
	return result.map((row) => ({
		...to_user_summary(row),
		is_following: Boolean(row.is_following),
		is_followed_by: Boolean(row.is_followed_by),
		is_self: viewer_id === row.id,
	}))
}

export const is_following_sql = (viewer_id: string | null) =>
	viewer_id
		? sql<number>`exists(select 1 from "follow" where "follow"."follower_id" = ${viewer_id} and "follow"."following_id" = "user"."id")`
		: sql<number>`0`
