import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { error } from '@sveltejs/kit'
import type { Db } from '../db'
import { user } from '../db/schema'
import type { UserSummary } from '$lib/types'

export function to_user_summary(row: {
	id: string
	name: string
	username: string | null
	image: string | null
}): UserSummary {
	return {
		id: row.id,
		name: row.name,
		username: row.username,
		handle: row.username ?? row.id,
		image: row.image,
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

export const is_following_sql = (viewer_id: string | null) =>
	viewer_id
		? sql<number>`exists(select 1 from "follow" where "follow"."follower_id" = ${viewer_id} and "follow"."following_id" = "user"."id")`
		: sql<number>`0`
