import { and, desc, eq, isNull, ne, or, sql } from 'drizzle-orm'
import { error } from '@sveltejs/kit'
import type { Db } from '../db'
import { follow, user } from '../db/schema'
import {
	MAX_BIO_LENGTH,
	MAX_INTEREST_LENGTH,
	MAX_INTERESTS_COUNT,
	MAX_NAME_LENGTH,
	MAX_SUGGESTION_LIMIT,
} from '$lib/limits'
import type { UserListItem, UserSummary } from '$lib/types'
import { is_unique_constraint_error, validate_interests } from '../validation'
import { clamp_limit } from './cursor'

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
 *
 * Only UNIQUE constraint violations are retried (another user claimed the same username).
 * Any other database error is propagated immediately so it isn't silently hidden.
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
		} catch (err) {
			// Only retry on UNIQUE constraint violations (someone else claimed this username).
			// Propagate any other database error immediately.
			if (!is_unique_constraint_error(err)) throw err
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

/**
 * Validates the profile fields and applies them in ONE UPDATE statement. A single statement is
 * atomic on D1 (which has no interactive transactions), so either every column changes or none
 * does. `extra` columns are written in that same statement; `extra.interests` takes precedence
 * over `input.interests`.
 */
async function apply_profile_update(
	db: Db,
	user_id: string,
	input: {
		name?: unknown
		username?: unknown
		bio?: unknown
		interests?: unknown
	},
	extra: { onboarded?: boolean; interests?: string | null } = {},
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
		// Known limitation (intentional): the old username is not kept as an alias or redirect, so
		// /u/<old> stops resolving once it changes. /u/<user id> always resolves and is the
		// stable permalink. (Aliases would need a username-history table and a reservation policy.)
		// Pre-check for a friendlier error message (non-atomic, see below for constraint catch).
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
	if (input.interests !== undefined && input.interests !== null) {
		next_interests = JSON.stringify(validate_interests(input.interests))
	}
	if (extra.interests !== undefined) next_interests = extra.interests

	const now = new Date()
	try {
		await db
			.update(user)
			.set({
				name: next_name,
				username: next_username,
				bio: next_bio,
				interests: next_interests,
				...(extra.onboarded !== undefined ? { onboarded: extra.onboarded } : {}),
				updatedAt: now,
			})
			.where(eq(user.id, user_id))
	} catch (err) {
		// Handle the race condition where two requests both pass the availability
		// check but the DB unique constraint catches the second one.
		if (is_unique_constraint_error(err)) {
			error(400, 'Username is already taken')
		}
		throw err
	}

	return {
		name: next_name,
		username: next_username,
		bio: next_bio,
		interests: next_interests,
		image: current.image,
	}
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
	const next = await apply_profile_update(db, user_id, input)
	return { id: user_id, ...next, handle: next.username ?? user_id }
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
	// Everything is validated, then written in a single UPDATE together with `onboarded`, so a
	// failure can never leave the profile changed while onboarding is still incomplete.
	const interests_json =
		input.interests !== undefined && input.interests !== null
			? JSON.stringify(validate_interests(input.interests))
			: null
	await apply_profile_update(
		db,
		user_id,
		{ name: input.name, username: input.username, bio: input.bio },
		{ onboarded: true, interests: interests_json },
	)
	return { onboarded: true, interests: interests_json }
}

export async function get_suggested_users(
	db: Db,
	viewer_id: string,
	limit = 5,
): Promise<UserListItem[]> {
	limit = clamp_limit(limit, 5, MAX_SUGGESTION_LIMIT)
	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			username: user.username,
			image: user.image,
			bio: user.bio,
			is_following: sql<number>`exists(select 1 from ${follow} where ${follow.followerId} = ${viewer_id} and ${follow.followingId} = ${user.id})`,
			is_followed_by: sql<number>`exists(select 1 from ${follow} where ${follow.followerId} = ${user.id} and ${follow.followingId} = ${viewer_id})`,
		})
		.from(user)
		.where(
			and(
				ne(user.id, viewer_id),
				sql`not exists(select 1 from ${follow} where ${follow.followerId} = ${viewer_id} and ${follow.followingId} = ${user.id})`,
			),
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
 * with `interests`, newest accounts first. Falls back to recent users if no usable interests
 * are given.
 *
 * Matching happens in the database (SQLite JSON1: `json_each` over the stored JSON array), so
 * every user is considered. There is no "latest N users" cap: a matching user is never missed
 * just because they signed up a while ago. Matching is case-insensitive for ASCII (SQLite's
 * `lower()`); non-ASCII scripts such as Japanese have no case and match exactly.
 *
 * Design note: this still scans the user table (parsing each row's interests JSON) per request,
 * with the result bounded by `limit`. That is intentional for the expected workload (< 10k
 * users). At larger scale, normalise interests into a `user_interest(user_id, interest)` table
 * with an index on `interest` and join against it instead.
 */
export async function get_users_by_interests(
	db: Db,
	viewer_id: string,
	interests: string[],
	limit = 5,
): Promise<UserListItem[]> {
	limit = clamp_limit(limit, 5, MAX_SUGGESTION_LIMIT)
	const wanted = [
		...new Set(
			interests
				.map((interest) => interest.trim().toLowerCase())
				.filter((interest) => interest.length > 0 && interest.length <= MAX_INTEREST_LENGTH),
		),
	].slice(0, MAX_INTERESTS_COUNT)
	if (wanted.length === 0) return get_suggested_users(db, viewer_id, limit)

	// json_valid() guards json_each(), which throws on malformed JSON.
	const shares_interest = sql<number>`case when json_valid(${user.interests}) then exists(select 1 from json_each(${user.interests}) as interest where lower(interest.value) in (${sql.join(
		wanted.map((interest) => sql`${interest}`),
		sql`, `,
	)})) else 0 end`

	const rows = await db
		.select({
			id: user.id,
			name: user.name,
			username: user.username,
			image: user.image,
			bio: user.bio,
			is_following: sql<number>`exists(select 1 from ${follow} where ${follow.followerId} = ${viewer_id} and ${follow.followingId} = ${user.id})`,
			is_followed_by: sql<number>`exists(select 1 from ${follow} where ${follow.followerId} = ${user.id} and ${follow.followingId} = ${viewer_id})`,
		})
		.from(user)
		.where(
			and(
				shares_interest,
				ne(user.id, viewer_id),
				sql`not exists(select 1 from ${follow} where ${follow.followerId} = ${viewer_id} and ${follow.followingId} = ${user.id})`,
			),
		)
		.orderBy(desc(user.createdAt), desc(user.id))
		.limit(limit)

	return rows.map((row) => ({
		...to_user_summary(row),
		is_following: Boolean(row.is_following),
		is_followed_by: Boolean(row.is_followed_by),
		is_self: viewer_id === row.id,
	}))
}
