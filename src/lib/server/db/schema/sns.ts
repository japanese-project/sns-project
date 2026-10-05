// Application (SNS) tables: post, comment, like, bookmark, follow.
// See docs/database.md for the ERD and constraints this schema implements.
import {
	sqliteTable,
	text,
	integer,
	primaryKey,
	index,
	uniqueIndex,
	check,
	type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { user } from './auth'

export const user_settings = sqliteTable('user_settings', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	isPrivate: integer('is_private', { mode: 'boolean' }).notNull().default(false),
	notifyOnFollow: integer('notify_on_follow', { mode: 'boolean' }).notNull().default(true),
	notifyOnLike: integer('notify_on_like', { mode: 'boolean' }).notNull().default(true),
	notifyOnComment: integer('notify_on_comment', { mode: 'boolean' }).notNull().default(true),
	updatedAt: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
})

export const post = sqliteTable(
	'post',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		content: text('content').notNull(),
		visibility: text('visibility', { enum: ['public', 'followers-only'] })
			.notNull()
			.default('public'),
		imageUrl: text('image_url'),
		// Set on a repost: an empty, always-public row by the reposter that points at the original.
		// Readable only while the original is (see visible_to); deleted along with it.
		repostOfId: text('repost_of_id').references((): AnySQLiteColumn => post.id, {
			onDelete: 'cascade',
		}),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [
		index('post_user_id_idx').on(table.userId),
		index('post_created_at_idx').on(table.createdAt),
		// One repost per user per post; also serves the per-post repost count. Ordinary posts have
		// a NULL repost_of_id, and SQLite treats NULLs as distinct, so they never collide.
		uniqueIndex('post_repost_of_user_unique').on(table.repostOfId, table.userId),
	],
)

export const comment = sqliteTable(
	'comment',
	{
		id: text('id').primaryKey(),
		postId: text('post_id')
			.notNull()
			.references(() => post.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		// One-level nesting only: a reply's parent must be a top-level comment
		// on the same post. This is enforced at the application level.
		parentId: text('parent_id'),
		content: text('content').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [
		index('comment_post_id_idx').on(table.postId),
		index('comment_user_id_idx').on(table.userId),
		index('comment_parent_id_idx').on(table.parentId),
	],
)

export const like = sqliteTable(
	'like',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		postId: text('post_id')
			.notNull()
			.references(() => post.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.postId] }),
		index('like_post_id_idx').on(table.postId),
	],
)

// A user's private "favorites" collection. Same shape as `like`, but never counted or shown
// to anyone except the owner, and never produces a notification.
export const bookmark = sqliteTable(
	'bookmark',
	{
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		postId: text('post_id')
			.notNull()
			.references(() => post.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.postId] }),
		index('bookmark_post_id_idx').on(table.postId),
	],
)

export const follow = sqliteTable(
	'follow',
	{
		followerId: text('follower_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		followingId: text('following_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [
		primaryKey({ columns: [table.followerId, table.followingId] }),
		index('follow_following_id_idx').on(table.followingId),
		check('follow_no_self_follow', sql`${table.followerId} != ${table.followingId}`),
	],
)

export const follow_request = sqliteTable(
	'follow_request',
	{
		followerId: text('follower_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		followingId: text('following_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [
		primaryKey({ columns: [table.followerId, table.followingId] }),
		index('follow_request_following_id_idx').on(table.followingId),
		check('follow_request_no_self_follow', sql`${table.followerId} != ${table.followingId}`),
	],
)

export const notification = sqliteTable(
	'notification',
	{
		id: text('id').primaryKey(),
		recipientId: text('recipient_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		actorId: text('actor_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		type: text('type', { enum: ['like', 'comment', 'follow', 'repost'] }).notNull(),
		postId: text('post_id').references(() => post.id, { onDelete: 'cascade' }),
		commentId: text('comment_id').references(() => comment.id, { onDelete: 'cascade' }),
		// De-duplication policy (docs/database.md): like and follow notifications carry a
		// key of `<type>:<actor>:<target>` (repost too) so repeating the action never creates a second
		// entry. Comment notifications have a NULL key (every comment notifies).
		dedupeKey: text('dedupe_key'),
		read: integer('read', { mode: 'boolean' }).notNull().default(false),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [
		index('notification_recipient_created_idx').on(table.recipientId, table.createdAt),
		uniqueIndex('notification_dedupe_key_unique').on(table.dedupeKey),
	],
)

export const media_cleanup_lock = sqliteTable('media_cleanup_lock', {
	key: text('key').primaryKey(),
	lockedAt: integer('locked_at').notNull(),
	owner: text('owner').notNull(),
})
