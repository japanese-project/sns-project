import type { Db } from '../db'
import { user_settings, follow_request } from '../db/schema/sns'
import { eq, and } from 'drizzle-orm'

export async function get_user_settings(db: Db, userId: string) {
	const settings = await db.query.user_settings.findFirst({
		where: eq(user_settings.userId, userId),
	})
	if (settings) {
		return settings
	}
	// Default settings if they don't exist yet
	return {
		userId,
		isPrivate: false,
		notifyOnFollow: true,
		notifyOnLike: true,
		notifyOnComment: true,
	}
}

export async function update_user_settings(
	db: Db,
	userId: string,
	partial: Partial<typeof user_settings.$inferInsert>,
) {
	const settings = await get_user_settings(db, userId)

	await db
		.insert(user_settings)
		.values({ ...settings, ...partial, userId })
		.onConflictDoUpdate({
			target: user_settings.userId,
			set: { ...partial, updatedAt: new Date() },
		})
}

export async function has_pending_follow_request(db: Db, followerId: string, followingId: string) {
	const req = await db.query.follow_request.findFirst({
		where: and(
			eq(follow_request.followerId, followerId),
			eq(follow_request.followingId, followingId),
		),
	})
	return !!req
}
