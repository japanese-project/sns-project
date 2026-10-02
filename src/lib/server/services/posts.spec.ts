import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MAX_POST_LENGTH, TRENDING_SCAN_LIMIT } from '$lib/limits'
import type { Db } from '../db'
import { follow, post } from '../db/schema'
import {
	create_post,
	delete_post,
	get_trending_topics,
	get_visible_post,
	list_feed,
	update_post,
} from './posts'
import { new_id } from './cursor'
import { create_test_db, make_follow, make_user } from './test-db'

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

describe('create_post validation', () => {
	it('rejects empty and whitespace-only text', async () => {
		expect(await status_of(create_post(db, alice, { content: '' }))).toBe(400)
		expect(await status_of(create_post(db, alice, { content: '   \n ' }))).toBe(400)
		expect(await status_of(create_post(db, alice, { content: undefined }))).toBe(400)
	})

	it('rejects text over the maximum length but accepts exactly the maximum', async () => {
		expect(
			await status_of(create_post(db, alice, { content: 'x'.repeat(MAX_POST_LENGTH + 1) })),
		).toBe(400)
		const ok = await create_post(db, alice, { content: 'x'.repeat(MAX_POST_LENGTH) })
		expect(ok.content).toHaveLength(MAX_POST_LENGTH)
	})

	it('rejects an invalid visibility value', async () => {
		expect(await status_of(create_post(db, alice, { content: 'hi', visibility: 'private' }))).toBe(
			400,
		)
	})

	it('defaults to public and persists followers-only', async () => {
		expect((await create_post(db, alice, { content: 'default' })).visibility).toBe('public')
		const f = await create_post(db, alice, { content: 'secret', visibility: 'followers-only' })
		expect(f.visibility).toBe('followers-only')
		expect((await get_visible_post(db, alice, f.id))?.visibility).toBe('followers-only')
	})

	it('trims and stores the author', async () => {
		const p = await create_post(db, bob, { content: '  hello  ' })
		expect(p.content).toBe('hello')
		expect(p.author.id).toBe(bob)
		expect(p.is_owner).toBe(true)
	})
})

describe('visibility', () => {
	let secret_id: string
	let public_id: string
	beforeAll(async () => {
		secret_id = (
			await create_post(db, alice, { content: 'followers only!', visibility: 'followers-only' })
		).id
		public_id = (await create_post(db, alice, { content: 'everyone', visibility: 'public' })).id
	})

	it('a non-follower sees public posts only', async () => {
		expect(await get_visible_post(db, carol, public_id)).not.toBeNull()
		expect(await get_visible_post(db, carol, secret_id)).toBeNull()
		const feed = await list_feed(db, carol, { limit: 50 })
		expect(feed.items.some((p) => p.id === secret_id)).toBe(false)
		expect(feed.items.some((p) => p.id === public_id)).toBe(true)
	})

	it('the author sees their own followers-only post via direct view and following feed, but global feed is public-only', async () => {
		expect(await get_visible_post(db, alice, secret_id)).not.toBeNull()
		expect((await list_feed(db, alice, { limit: 50 })).items.some((p) => p.id === secret_id)).toBe(
			false,
		)
		expect(
			(await list_feed(db, alice, { feed: 'following', limit: 50 })).items.some(
				(p) => p.id === secret_id,
			),
		).toBe(true)
	})

	it('a non-follower cannot see it, a follower can in following feed', async () => {
		expect(await get_visible_post(db, carol, secret_id)).toBeNull()
		expect(
			(await list_feed(db, carol, { feed: 'following', limit: 50 })).items.some(
				(p) => p.id === secret_id,
			),
		).toBe(false)
		await make_follow(db, carol, alice)
		expect(await get_visible_post(db, carol, secret_id)).not.toBeNull()
		expect(
			(await list_feed(db, carol, { feed: 'following', limit: 50 })).items.some(
				(p) => p.id === secret_id,
			),
		).toBe(true)
		await db.delete(follow)
	})

	it('following the wrong direction grants nothing', async () => {
		await make_follow(db, alice, carol) // alice follows carol, not the reverse
		expect(await get_visible_post(db, carol, secret_id)).toBeNull()
		await db.delete(follow)
	})
})

describe('pagination', () => {
	it('is newest-first, never duplicates or skips, and survives new posts', async () => {
		const author = await make_user(db, 'Pager')
		const ids: string[] = []
		// Several posts share the same second to exercise the id tie-breaker.
		for (let i = 0; i < 12; i++) {
			const id = crypto.randomUUID()
			await db.insert(post).values({
				id,
				userId: author,
				content: `p${i}`,
				visibility: 'public',
				createdAt: new Date(1_800_000_000_000 + Math.floor(i / 3) * 1000),
				updatedAt: new Date(),
			})
			ids.push(id)
		}
		const mine = (items: { id: string; author: { id: string } }[]) =>
			items.filter((p) => p.author.id === author).map((p) => p.id)

		const first = await list_feed(db, carol, { limit: 5 })
		expect(first.next_cursor).not.toBeNull()

		// A brand-new post arrives between page loads: it must not shift the cursor.
		await create_post(db, author, { content: 'late arrival' })

		const collected = [...first.items]
		let cursor = first.next_cursor
		while (cursor) {
			const next = await list_feed(db, carol, { limit: 5, cursor })
			collected.push(...next.items)
			cursor = next.next_cursor
		}
		const seen = mine(collected).filter((id) => ids.includes(id))
		expect(new Set(seen).size).toBe(seen.length)
		expect(seen.sort()).toEqual([...ids].sort())

		const times = collected.map((p) => p.created_at)
		expect([...times].sort().reverse()).toEqual(times)
	})

	it('rejects a malformed cursor', async () => {
		expect(await status_of(list_feed(db, alice, { cursor: '!!!not-a-cursor' }))).toBe(400)
	})
})

describe('edit and delete', () => {
	it('only the owner can edit or delete', async () => {
		const p = await create_post(db, alice, { content: 'mine' })
		expect(await status_of(update_post(db, bob, p.id, { content: 'hijack' }))).toBe(403)
		expect(await status_of(delete_post(db, bob, p.id))).toBe(403)
		const edited = await update_post(db, alice, p.id, { content: 'edited' })
		expect(edited.content).toBe('edited')
		await delete_post(db, alice, p.id)
		expect(await get_visible_post(db, alice, p.id)).toBeNull()
	})

	it('validates edited content with the creation rules', async () => {
		const p = await create_post(db, alice, { content: 'valid' })
		expect(await status_of(update_post(db, alice, p.id, { content: '  ' }))).toBe(400)
		expect(
			await status_of(update_post(db, alice, p.id, { content: 'x'.repeat(MAX_POST_LENGTH + 1) })),
		).toBe(400)
	})

	it('hides other users’ followers-only posts even from edit attempts', async () => {
		const p = await create_post(db, alice, { content: 'hidden', visibility: 'followers-only' })
		expect(await status_of(update_post(db, carol, p.id, { content: 'x' }))).toBe(404)
		expect(await status_of(delete_post(db, carol, p.id))).toBe(404)
	})

	it('returns 404 for missing posts', async () => {
		expect(await status_of(update_post(db, alice, 'nope', { content: 'x' }))).toBe(404)
		expect(await status_of(delete_post(db, alice, 'nope'))).toBe(404)
	})
})

describe('feed separation (following vs global)', () => {
	it('feed=following shows posts by followed users and own posts, but not strangers', async () => {
		const u1 = await make_user(db, 'FeedUserOne')
		const u2 = await make_user(db, 'FeedUserTwo')
		const stranger = await make_user(db, 'FeedStranger')

		const p1 = await create_post(db, u1, { content: 'from u1' })
		const p2 = await create_post(db, u2, { content: 'from u2' })
		const p_stranger = await create_post(db, stranger, { content: 'from stranger' })

		// Before u1 follows u2: u1's following feed only has u1's post
		const u1_feed_init = await list_feed(db, u1, { feed: 'following' })
		expect(u1_feed_init.items.map((p) => p.id)).toEqual([p1.id])

		// After u1 follows u2: u1's following feed has p2 and p1, but NOT p_stranger
		await make_follow(db, u1, u2)
		const u1_feed_after = await list_feed(db, u1, { feed: 'following' })
		const ids = u1_feed_after.items.map((p) => p.id)
		expect(ids).toContain(p1.id)
		expect(ids).toContain(p2.id)
		expect(ids).not.toContain(p_stranger.id)

		// Global feed includes all public posts
		const global_feed = await list_feed(db, u1, { feed: 'global' })
		const global_ids = global_feed.items.map((p) => p.id)
		expect(global_ids).toContain(p_stranger.id)
	})
})

describe('get_trending_topics', () => {
	it('extracts hashtags from public posts and ranks by frequency', async () => {
		await create_post(db, alice, { content: 'Loving #svelte and #typescript!' })
		await create_post(db, bob, { content: 'More #svelte discussions today' })
		await create_post(db, carol, {
			content: 'Followers only #secret',
			visibility: 'followers-only',
		})

		const topics = await get_trending_topics(db, 5, 'month')
		const tags = topics.map((t) => t.tag)
		expect(tags).toContain('svelte')
		expect(tags).toContain('typescript')
		// followers-only posts are excluded from public trending
		expect(tags).not.toContain('secret')

		const svelte_topic = topics.find((t) => t.tag === 'svelte')
		expect(svelte_topic?.count).toBe(2)
	})

	it('filters by period (today / week / month)', async () => {
		// Create a post with a timestamp from 10 days ago
		const old_date = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
		await db.insert(post).values({
			id: `trend-old-${crypto.randomUUID()}`,
			userId: alice,
			content: 'Old topic #retro',
			visibility: 'public',
			createdAt: old_date,
			updatedAt: old_date,
		})
		// Create a post from right now
		await create_post(db, alice, { content: 'Fresh topic #fresh' })

		// 'today' should only include #fresh
		const today = await get_trending_topics(db, 10, 'today')
		const today_tags = today.map((t) => t.tag)
		expect(today_tags).toContain('fresh')
		expect(today_tags).not.toContain('retro')

		// 'week' should only include #fresh (retro is 10 days old)
		const week = await get_trending_topics(db, 10, 'week')
		const week_tags = week.map((t) => t.tag)
		expect(week_tags).toContain('fresh')
		expect(week_tags).not.toContain('retro')

		// 'month' should include both
		const month = await get_trending_topics(db, 10, 'month')
		const month_tags = month.map((t) => t.tag)
		expect(month_tags).toContain('fresh')
		expect(month_tags).toContain('retro')
	})

	describe('scan window', () => {
		const one_day = 24 * 60 * 60 * 1000

		// These tests assert on exact results, so start from no posts (the rest of this file
		// shares one database).
		beforeEach(async () => {
			await db.delete(post)
		})

		async function insert_posts(rows: { content: string; created_at: Date }[]) {
			// D1 allows at most 100 bound parameters per statement, so insert in small chunks.
			for (let i = 0; i < rows.length; i += 10) {
				await db.insert(post).values(
					rows.slice(i, i + 10).map((row) => ({
						id: new_id(),
						userId: alice,
						content: row.content,
						visibility: 'public' as const,
						createdAt: row.created_at,
						updatedAt: row.created_at,
					})),
				)
			}
		}

		it('is not crowded out by newer posts that contain no hashtag', async () => {
			const now = Date.now()
			await insert_posts([
				{ content: 'older but tagged #keepme', created_at: new Date(now - 2 * one_day) },
			])
			await insert_posts(
				Array.from({ length: TRENDING_SCAN_LIMIT + 20 }, (_, i) => ({
					content: `plain chatter ${i}`,
					created_at: new Date(now - i * 1000),
				})),
			)
			const tags = (await get_trending_topics(db, 10, 'week')).map((t) => t.tag)
			expect(tags).toContain('keepme')
		})

		// Pins the documented limitation: only the newest TRENDING_SCAN_LIMIT hashtagged posts in
		// the window are analysed, so counts are per sampled post and older tags can drop out.
		it('only analyses the newest TRENDING_SCAN_LIMIT hashtagged posts in the window', async () => {
			const now = Date.now()
			await insert_posts(
				Array.from({ length: 3 }, (_, i) => ({
					content: `still active this week #oldtag ${i}`,
					created_at: new Date(now - 3 * one_day - i * 1000),
				})),
			)
			await insert_posts(
				Array.from({ length: TRENDING_SCAN_LIMIT }, (_, i) => ({
					content: `busy #newtag ${i}`,
					created_at: new Date(now - i * 1000),
				})),
			)
			const topics = await get_trending_topics(db, 10, 'week')
			expect(topics).toEqual([{ tag: 'newtag', count: TRENDING_SCAN_LIMIT }])
		})
	})
})
