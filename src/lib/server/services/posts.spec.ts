import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Db } from '../db'
import { comment, like, notification } from '../db/schema'
import { delete_post, get_visible_post } from './posts'
import { create_test_db, make_follow, make_post, make_user } from './test-db'

let db: Db
let dispose: () => Promise<void>
let alice: string
let bob: string
let carol: string

beforeAll(async () => {
	;({ db, dispose } = await create_test_db())
	alice = await make_user(db, 'Alice')
	bob = await make_user(db, 'Bob')
	carol = await make_user(db, 'Carol')
})
afterAll(() => dispose())

async function status_of(promise: Promise<unknown>) {
	try {
		await promise
		return 200
	} catch (e) {
		return (e as { status?: number }).status ?? 500
	}
}

describe('post visibility authorization', () => {
	it('followers-only posts are visible to author and followers, but not strangers or anon', async () => {
		const secret = await make_post(db, alice, {
			content: 'followers only!',
			visibility: 'followers-only',
		})
		const pub = await make_post(db, alice, {
			content: 'everyone',
			visibility: 'public',
		})

		// Anonymous
		expect(await get_visible_post(db, null, pub.id)).not.toBeNull()
		expect(await get_visible_post(db, null, secret.id)).toBeNull()

		// Author sees both
		expect(await get_visible_post(db, alice, secret.id)).not.toBeNull()

		// Carol (not following) only sees public
		expect(await get_visible_post(db, carol, secret.id)).toBeNull()

		// Carol follows Alice -> now sees secret
		await make_follow(db, carol, alice)
		expect(await get_visible_post(db, carol, secret.id)).not.toBeNull()
	})
})

describe('post deletion and cascade', () => {
	it('non-owner cannot delete and receives 403 (or 404 if hidden)', async () => {
		const p = await make_post(db, alice, 'alice post')
		expect(await status_of(delete_post(db, bob, p.id))).toBe(403)

		const hidden = await make_post(db, alice, {
			content: 'hidden',
			visibility: 'followers-only',
		})
		// Bob doesn't follow Alice, so the post appears non-existent (404, not 403)
		expect(await status_of(delete_post(db, bob, hidden.id))).toBe(404)
	})

	it('owner can delete, which cascades to likes, comments and notifications', async () => {
		const p = await make_post(db, alice, 'to be deleted')
		const now = new Date()

		await db.insert(like).values({ postId: p.id, userId: bob, createdAt: now })
		await db.insert(comment).values({
			id: 'c1',
			postId: p.id,
			userId: bob,
			content: 'hi',
			createdAt: now,
			updatedAt: now,
		})
		await db.insert(notification).values({
			id: 'n1',
			recipientId: alice,
			actorId: bob,
			type: 'like',
			postId: p.id,
			createdAt: now,
		})

		await delete_post(db, alice, p.id)

		// Post is gone
		expect(await get_visible_post(db, alice, p.id)).toBeNull()

		// Cascades at DB level
		const remaining_likes = await db.select().from(like).all()
		expect(remaining_likes.filter((l) => l.postId === p.id)).toHaveLength(0)

		const remaining_comments = await db.select().from(comment).all()
		expect(remaining_comments.filter((c) => c.postId === p.id)).toHaveLength(0)

		const remaining_notes = await db.select().from(notification).all()
		expect(remaining_notes.filter((n) => n.postId === p.id)).toHaveLength(0)
	})
})
