import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db'
import { bookmark, comment, follow, like, notification, post, user } from '../db/schema'
import { bookmark_post, unbookmark_post } from './bookmarks'
import { repost_post, unrepost_post } from './reposts'
import { create_comment, delete_comment, list_comments, update_comment } from './comments'
import { follow_user, list_followers, list_following, unfollow_user } from './follows'
import { like_post, unlike_post } from './likes'
import { list_notifications, mark_read, unread_count } from './notifications'
import {
	create_post,
	delete_post,
	list_bookmarked_posts,
	list_feed,
	list_liked_posts,
	list_posts_by_user,
	update_post,
} from './posts'
import { parse_query, search_all, search_users } from './search'
import { create_test_db, make_follow, make_user } from './test-db'
import { eq } from 'drizzle-orm'

let db: Db
let dispose: () => Promise<void>
let alice: string
let bob: string
let carol: string

beforeAll(async () => {
	;({ db, dispose } = await create_test_db())
})
afterAll(() => dispose())

beforeEach(async () => {
	await db.delete(notification)
	await db.delete(like)
	await db.delete(bookmark)
	await db.delete(comment)
	await db.delete(follow)
	await db.delete(post)
	await db.delete(user)
	alice = await make_user(db, 'Alice')
	bob = await make_user(db, 'Bob')
	carol = await make_user(db, 'Carol')
})

async function status_of(promise: Promise<unknown>) {
	try {
		await promise
		return 200
	} catch (e) {
		return (e as { status?: number }).status ?? 500
	}
}

describe('likes', () => {
	it('toggles and never stacks duplicates', async () => {
		const p = await create_post(db, alice, { content: 'like me' })
		expect((await like_post(db, bob, p.id)).like_count).toBe(1)
		expect((await like_post(db, bob, p.id)).like_count).toBe(1)
		expect((await like_post(db, carol, p.id)).like_count).toBe(2)
		expect((await unlike_post(db, bob, p.id)).like_count).toBe(1)
		expect((await unlike_post(db, bob, p.id)).like_count).toBe(1)
		const [view] = (await list_feed(db, carol)).items
		expect(view.like_count).toBe(1)
		expect(view.liked_by_me).toBe(true)
	})

	it('cannot like a post the user cannot see', async () => {
		const p = await create_post(db, alice, { content: 'hidden', visibility: 'followers-only' })
		expect(await status_of(like_post(db, bob, p.id))).toBe(404)
		await make_follow(db, bob, alice)
		expect((await like_post(db, bob, p.id)).liked).toBe(true)
	})
})

describe('liked posts list', () => {
	it("lists only the viewer's likes, most recently liked first", async () => {
		const older = await create_post(db, alice, { content: 'older post' })
		const newer = await create_post(db, alice, { content: 'newer post' })
		await create_post(db, alice, { content: 'not liked' })
		// Liked in the opposite order to posting: the list follows like time, not post time.
		await db.insert(like).values([
			{ userId: bob, postId: newer.id, createdAt: new Date('2026-01-01T00:00:00Z') },
			{ userId: bob, postId: older.id, createdAt: new Date('2026-01-02T00:00:00Z') },
			{ userId: carol, postId: newer.id },
		])
		const page = await list_liked_posts(db, bob)
		expect(page.items.map((p) => p.content)).toEqual(['older post', 'newer post'])
		expect(page.items.every((p) => p.liked_by_me)).toBe(true)
		expect(page.next_cursor).toBeNull()
	})

	it('pages with a cursor keyed on like time', async () => {
		const posts = []
		for (const n of [1, 2, 3]) posts.push(await create_post(db, alice, { content: `p${n}` }))
		await db.insert(like).values(
			posts.map((p, i) => ({
				userId: bob,
				postId: p.id,
				createdAt: new Date(Date.UTC(2026, 0, 1 + i)),
			})),
		)
		const first = await list_liked_posts(db, bob, { limit: 2 })
		expect(first.items.map((p) => p.content)).toEqual(['p3', 'p2'])
		const second = await list_liked_posts(db, bob, { limit: 2, cursor: first.next_cursor })
		expect(second.items.map((p) => p.content)).toEqual(['p1'])
		expect(second.next_cursor).toBeNull()
	})
})

describe('bookmarks', () => {
	it('are idempotent, listed newest first, and flagged only for their owner', async () => {
		const a = await create_post(db, alice, { content: 'first' })
		const b = await create_post(db, carol, { content: 'second' })
		expect(await bookmark_post(db, bob, a.id)).toEqual({ bookmarked: true })
		expect(await bookmark_post(db, bob, a.id)).toEqual({ bookmarked: true })
		await bookmark_post(db, bob, b.id)
		expect(await db.select().from(bookmark).where(eq(bookmark.userId, bob))).toHaveLength(2)

		expect((await list_bookmarked_posts(db, bob)).items.map((p) => p.id)).toEqual([b.id, a.id])
		expect((await list_bookmarked_posts(db, alice)).items).toEqual([])
		expect((await list_posts_by_user(db, bob, alice)).items[0].bookmarked_by_me).toBe(true)
		expect((await list_posts_by_user(db, alice, alice)).items[0].bookmarked_by_me).toBe(false)
		// Private: saving a post never notifies its author.
		expect(await db.select().from(notification)).toHaveLength(0)

		expect(await unbookmark_post(db, bob, a.id)).toEqual({ bookmarked: false })
		expect(await unbookmark_post(db, bob, a.id)).toEqual({ bookmarked: false })
		expect((await list_bookmarked_posts(db, bob)).items.map((p) => p.id)).toEqual([b.id])
	})

	it('cannot target a post the user cannot see', async () => {
		const p = await create_post(db, alice, { content: 'hidden', visibility: 'followers-only' })
		expect(await status_of(bookmark_post(db, bob, p.id))).toBe(404)
		expect(await status_of(unbookmark_post(db, bob, p.id))).toBe(404)
		expect(await status_of(bookmark_post(db, bob, 'no-such-post'))).toBe(404)
	})

	it('drop out of the saved and liked lists once the post is no longer visible', async () => {
		const p = await create_post(db, alice, { content: 'inner', visibility: 'followers-only' })
		await make_follow(db, bob, alice)
		await bookmark_post(db, bob, p.id)
		await like_post(db, bob, p.id)
		expect((await list_bookmarked_posts(db, bob)).items).toHaveLength(1)
		expect((await list_liked_posts(db, bob)).items).toHaveLength(1)

		await unfollow_user(db, bob, alice)
		expect((await list_bookmarked_posts(db, bob)).items).toHaveLength(0)
		expect((await list_liked_posts(db, bob)).items).toHaveLength(0)
	})

	it('are removed when the post is deleted', async () => {
		const p = await create_post(db, alice, { content: 'temporary' })
		await bookmark_post(db, bob, p.id)
		await delete_post(db, alice, p.id)
		expect(await db.select().from(bookmark)).toHaveLength(0)
	})
})

describe('reposts', () => {
	it("show on the reposter's profile and followers' following feed, not the global feed", async () => {
		const p = await create_post(db, alice, { content: 'worth sharing' })
		expect(await repost_post(db, bob, p.id)).toEqual({ reposted: true, repost_count: 1 })
		expect(await repost_post(db, bob, p.id)).toEqual({ reposted: true, repost_count: 1 })

		const [item] = (await list_posts_by_user(db, carol, bob)).items
		expect(item.author.id).toBe(bob)
		expect(item.repost_of?.id).toBe(p.id)
		expect(item.repost_of?.content).toBe('worth sharing')

		await make_follow(db, carol, bob)
		const [following] = (await list_feed(db, carol, { feed: 'following' })).items
		expect([following.author.id, following.repost_of?.id]).toEqual([bob, p.id])
		expect((await list_feed(db, carol)).items.map((i) => i.id)).toEqual([p.id])

		const [original] = (await list_posts_by_user(db, bob, alice)).items
		expect([original.repost_count, original.reposted_by_me]).toEqual([1, true])
	})

	it('carry an optional caption that can be changed by reposting again', async () => {
		const p = await create_post(db, alice, { content: 'worth sharing' })
		await repost_post(db, bob, p.id, { content: '  Totally agree  ' })
		const caption = async () => (await list_posts_by_user(db, carol, bob)).items[0].content
		expect(await caption()).toBe('Totally agree')

		// No content => caption untouched; new content => caption replaced; still one repost.
		expect((await repost_post(db, bob, p.id)).repost_count).toBe(1)
		expect(await caption()).toBe('Totally agree')
		await repost_post(db, bob, p.id, { content: 'On second thought' })
		expect(await caption()).toBe('On second thought')
		await repost_post(db, bob, p.id, { content: '' })
		expect(await caption()).toBe('')
		expect((await list_notifications(db, alice)).items).toHaveLength(1)

		expect(await status_of(repost_post(db, bob, p.id, { content: 'x'.repeat(10_000) }))).toBe(400)
		expect(await status_of(repost_post(db, bob, p.id, { content: 42 }))).toBe(400)
	})

	it('notify the author once; undoing removes the repost and its notification', async () => {
		const p = await create_post(db, alice, { content: 'notify me' })
		await repost_post(db, bob, p.id)
		await repost_post(db, bob, p.id)
		await repost_post(db, alice, p.id) // reposting your own post notifies nobody
		const notes = (await list_notifications(db, alice)).items
		expect(notes.map((n) => [n.type, n.actor.id, n.post_id])).toEqual([['repost', bob, p.id]])

		expect(await unrepost_post(db, bob, p.id)).toEqual({ reposted: false, repost_count: 1 })
		expect((await list_notifications(db, alice)).items).toEqual([])
		expect((await list_posts_by_user(db, carol, bob)).items).toEqual([])
	})

	it('of a repost reposts the original', async () => {
		const p = await create_post(db, alice, { content: 'original' })
		await repost_post(db, bob, p.id)
		const [bob_repost] = (await list_posts_by_user(db, carol, bob)).items
		expect((await repost_post(db, carol, bob_repost.id)).repost_count).toBe(2)
		const [carol_item] = (await list_posts_by_user(db, carol, carol)).items
		expect(carol_item.repost_of?.id).toBe(p.id)
	})

	it('refuse followers-only posts and hide once the original is no longer visible', async () => {
		const priv = await create_post(db, alice, { content: 'inner', visibility: 'followers-only' })
		await make_follow(db, bob, alice)
		expect(await status_of(repost_post(db, bob, priv.id))).toBe(403)
		expect(await status_of(repost_post(db, carol, priv.id))).toBe(404)

		const pub = await create_post(db, alice, { content: 'public for now' })
		await repost_post(db, bob, pub.id)
		expect((await list_posts_by_user(db, carol, bob)).items).toHaveLength(1)
		await update_post(db, alice, pub.id, { visibility: 'followers-only' })
		expect((await list_posts_by_user(db, carol, bob)).items).toHaveLength(0)
		expect((await list_posts_by_user(db, bob, bob)).items).toHaveLength(1)
	})

	it('cannot be edited, and are deleted along with the original', async () => {
		const p = await create_post(db, alice, { content: 'temporary' })
		await repost_post(db, bob, p.id)
		const [item] = (await list_posts_by_user(db, bob, bob)).items
		expect(await status_of(update_post(db, bob, item.id, { content: 'hijack' }))).toBe(400)
		await delete_post(db, alice, p.id)
		expect(await db.select().from(post)).toHaveLength(0)
	})
})

describe('comments', () => {
	it('lists comments oldest-first with replies nested one level', async () => {
		const p = await create_post(db, alice, { content: 'discuss' })
		const first = await create_comment(db, bob, p.id, { content: 'first' })
		const second = await create_comment(db, carol, p.id, { content: 'second' })
		await create_comment(db, alice, p.id, { content: 'reply', parent_id: first.id })
		const tree = await list_comments(db, bob, p.id)
		expect(tree.map((c) => c.content)).toEqual(['first', 'second'])
		expect(tree[0].replies.map((c) => c.content)).toEqual(['reply'])
		expect(tree[1].id).toBe(second.id)
	})

	it('flattens a reply to a reply onto the top-level parent', async () => {
		const p = await create_post(db, alice, { content: 'discuss' })
		const top = await create_comment(db, bob, p.id, { content: 'top' })
		const reply = await create_comment(db, carol, p.id, { content: 'reply', parent_id: top.id })
		const nested = await create_comment(db, alice, p.id, { content: 'deep', parent_id: reply.id })
		expect(nested.parent_id).toBe(top.id)
		const tree = await list_comments(db, bob, p.id)
		expect(tree).toHaveLength(1)
		expect(tree[0].replies.map((c) => c.content)).toEqual(['reply', 'deep'])
	})

	it('allows author to update comment, rejecting non-author and invalid content', async () => {
		const p = await create_post(db, alice, { content: 'test post' })
		const c = await create_comment(db, bob, p.id, { content: 'original note' })
		expect(await status_of(update_comment(db, carol, c.id, { content: 'hacked' }))).toBe(403)
		expect(await status_of(update_comment(db, bob, c.id, { content: '  ' }))).toBe(400)
		const updated = await update_comment(db, bob, c.id, { content: 'revised note' })
		expect(updated.content).toBe('revised note')
		expect(updated.is_owner).toBe(true)
	})

	it('allows author to delete comment and forbids non-author', async () => {
		const p = await create_post(db, alice, { content: 'test post' })
		const c = await create_comment(db, bob, p.id, { content: 'bye note' })
		expect(await status_of(delete_comment(db, carol, c.id))).toBe(403)
		await delete_comment(db, bob, c.id)
		expect(await list_comments(db, bob, p.id)).toHaveLength(0)
	})

	it('rejects invalid content and parents from another post', async () => {
		const p = await create_post(db, alice, { content: 'a' })
		const other = await create_post(db, alice, { content: 'b' })
		const elsewhere = await create_comment(db, bob, other.id, { content: 'x' })
		expect(await status_of(create_comment(db, bob, p.id, { content: '  ' }))).toBe(400)
		expect(await status_of(create_comment(db, bob, p.id, { content: 'x'.repeat(501) }))).toBe(400)
		expect(
			await status_of(create_comment(db, bob, p.id, { content: 'x', parent_id: elsewhere.id })),
		).toBe(400)
	})

	it('hides comments of followers-only posts from non-followers', async () => {
		const p = await create_post(db, alice, { content: 'secret', visibility: 'followers-only' })
		await create_comment(db, alice, p.id, { content: 'author note' })
		expect(await status_of(list_comments(db, bob, p.id))).toBe(404)
		expect(await status_of(create_comment(db, bob, p.id, { content: 'let me in' }))).toBe(404)
		await make_follow(db, bob, alice)
		expect(await list_comments(db, bob, p.id)).toHaveLength(1)
	})
})

describe('follows', () => {
	it('rejects self-follow', async () => {
		expect(await status_of(follow_user(db, alice, alice))).toBe(400)
	})

	it('is idempotent and unfollow removes the relation', async () => {
		await follow_user(db, bob, alice)
		const again = await follow_user(db, bob, alice)
		expect(again.follower_count).toBe(1)
		expect(await db.select().from(follow)).toHaveLength(1)
		expect((await unfollow_user(db, bob, alice)).follower_count).toBe(0)
		expect(await db.select().from(follow)).toHaveLength(0)
	})

	it('returns 404 for an unknown user', async () => {
		expect(await status_of(follow_user(db, alice, 'ghost'))).toBe(404)
	})

	it('real follow data unlocks followers-only posts and unfollow revokes it', async () => {
		const p = await create_post(db, alice, {
			content: 'inner circle',
			visibility: 'followers-only',
		})
		expect((await list_feed(db, bob, { feed: 'following' })).items).toHaveLength(0)
		await follow_user(db, bob, alice)
		expect((await list_feed(db, bob, { feed: 'following' })).items.map((x) => x.id)).toEqual([p.id])
		expect((await list_posts_by_user(db, bob, alice)).items).toHaveLength(1)
		await unfollow_user(db, bob, alice)
		expect((await list_feed(db, bob, { feed: 'following' })).items).toHaveLength(0)
		expect((await list_posts_by_user(db, bob, alice)).items).toHaveLength(0)
	})

	it('lists followers and following with stable pagination', async () => {
		const fans: string[] = []
		for (let i = 0; i < 7; i++) {
			const id = await make_user(db, `Fan${i}`)
			fans.push(id)
			await db.insert(follow).values({
				followerId: id,
				followingId: alice,
				createdAt: new Date(1_800_000_000_000 + Math.floor(i / 2) * 1000),
			})
		}
		await follow_user(db, alice, bob)
		const seen: string[] = []
		let cursor: string | null = null
		do {
			const page = await list_followers(db, carol, alice, { limit: 3, cursor })
			seen.push(...page.items.map((u) => u.id))
			cursor = page.next_cursor
		} while (cursor)
		expect(seen.sort()).toEqual([...fans].sort())
		expect((await list_following(db, carol, alice)).items.map((u) => u.id)).toEqual([bob])
		expect((await list_followers(db, carol, carol)).items).toEqual([])
	})
})

describe('notifications', () => {
	it('creates one notification per like and de-duplicates re-likes', async () => {
		const p = await create_post(db, alice, { content: 'x' })
		await like_post(db, bob, p.id)
		await like_post(db, bob, p.id)
		expect(await unread_count(db, alice)).toBe(1)
		await unlike_post(db, bob, p.id)
		expect(await unread_count(db, alice)).toBe(0)
		await like_post(db, bob, p.id)
		expect(await unread_count(db, alice)).toBe(1)
	})

	it('notifies on follow and comment, but never for your own actions', async () => {
		const p = await create_post(db, alice, { content: 'x' })
		await follow_user(db, bob, alice)
		await follow_user(db, bob, alice)
		await create_comment(db, bob, p.id, { content: 'hey' })
		await create_comment(db, alice, p.id, { content: 'self comment' })
		await like_post(db, alice, p.id)
		const page = await list_notifications(db, alice)
		expect(page.items.map((n) => n.type).sort()).toEqual(['comment', 'follow'])
		const comment_note = page.items.find((n) => n.type === 'comment')!
		expect(comment_note.actor.id).toBe(bob)
		expect(comment_note.snippet).toBe('hey')
	})

	it('notifies the parent comment author about replies', async () => {
		const p = await create_post(db, alice, { content: 'x' })
		const top = await create_comment(db, bob, p.id, { content: 'top' })
		await create_comment(db, carol, p.id, { content: 'reply', parent_id: top.id })
		expect((await list_notifications(db, bob)).items.map((n) => n.type)).toEqual(['comment'])
		expect(await unread_count(db, alice)).toBe(2)
	})

	it('only the owner can read or mark notifications', async () => {
		const p = await create_post(db, alice, { content: 'x' })
		await like_post(db, bob, p.id)
		const [note] = (await list_notifications(db, alice)).items
		expect((await list_notifications(db, carol)).items).toHaveLength(0)
		expect(await status_of(mark_read(db, carol, note.id))).toBe(404)
		expect(await unread_count(db, alice)).toBe(1)
		expect((await mark_read(db, alice, note.id)).unread_count).toBe(0)
		expect((await list_notifications(db, alice)).items[0].read).toBe(true)
	})

	it('marks everything read when no id is given', async () => {
		const p = await create_post(db, alice, { content: 'x' })
		await like_post(db, bob, p.id)
		await follow_user(db, carol, alice)
		expect(await unread_count(db, alice)).toBe(2)
		expect((await mark_read(db, alice)).unread_count).toBe(0)
	})

	it('deleting a post cascades to likes, comments and their notifications', async () => {
		const p = await create_post(db, alice, { content: 'x' })
		await like_post(db, bob, p.id)
		await create_comment(db, bob, p.id, { content: 'c' })
		expect(await unread_count(db, alice)).toBe(2)
		await delete_post(db, alice, p.id)
		expect(await db.select().from(like).where(eq(like.postId, p.id))).toHaveLength(0)
		expect(await db.select().from(comment).where(eq(comment.postId, p.id))).toHaveLength(0)
		expect(await unread_count(db, alice)).toBe(0)
	})
})

describe('search', () => {
	it('matches usernames case-insensitively', async () => {
		expect((await search_users(db, bob, 'ALI')).map((u) => u.id)).toEqual([alice])
		expect((await search_users(db, bob, '@bob')).map((u) => u.id)).toEqual([bob])
	})

	it('matches post text case-insensitively and treats wildcards literally', async () => {
		await create_post(db, alice, { content: 'Hello World' })
		await create_post(db, alice, { content: '100% sure' })
		expect((await search_all(db, bob, 'hello wORLD')).posts).toHaveLength(1)
		expect((await search_all(db, bob, '100%')).posts).toHaveLength(1)
		expect((await search_all(db, bob, '%')).posts).toHaveLength(1)
		expect((await search_all(db, bob, '_')).posts).toHaveLength(0)
	})

	it('never returns followers-only posts to non-followers', async () => {
		await create_post(db, alice, { content: 'needle public' })
		await create_post(db, alice, { content: 'needle secret', visibility: 'followers-only' })
		expect((await search_all(db, bob, 'needle')).posts).toHaveLength(1)
		expect((await search_all(db, alice, 'needle')).posts).toHaveLength(2)
		await make_follow(db, bob, alice)
		expect((await search_all(db, bob, 'needle')).posts).toHaveLength(2)
	})

	it('paginates results without duplicates', async () => {
		for (let i = 0; i < 7; i++) await create_post(db, alice, { content: `page item ${i}` })
		const seen: string[] = []
		let cursor: string | null = null
		do {
			const result = await search_all(db, bob, 'page item', { limit: 3, cursor })
			seen.push(...result.posts.map((p) => p.id))
			cursor = result.next_cursor
		} while (cursor)
		expect(seen).toHaveLength(7)
		expect(new Set(seen).size).toBe(7)
	})

	it('rejects empty and oversized queries', () => {
		expect(() => parse_query('   ')).toThrow()
		expect(() => parse_query(null)).toThrow()
		expect(() => parse_query('x'.repeat(101))).toThrow()
		expect(parse_query('  ok ')).toBe('ok')
	})
})
