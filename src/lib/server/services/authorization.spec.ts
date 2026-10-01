/**
 * Service-level authorization tests.
 *
 * These call the service functions directly, so they pin down the authorization rules
 * themselves. They do NOT exercise the route handlers (401 wiring, handle resolution, which
 * status an error becomes); that is covered by src/routes/api/authorization.spec.ts.
 * Rules covered here:
 *   - Anonymous access to public vs. followers-only posts
 *   - Non-owner post/comment modification
 *   - Notification isolation between users
 *   - Follow/unfollow authorization
 *   - Access to hidden/private posts through direct view, feeds, and search
 *   - Profile/follower/following visibility
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '../db'
import { comment, follow, like, notification, post, user } from '../db/schema'
import { create_comment, delete_comment, list_comments, update_comment } from './comments'
import {
	build_profile,
	follow_user,
	list_followers,
	list_following,
	unfollow_user,
} from './follows'
import { like_post } from './likes'
import { list_notifications, mark_read, unread_count } from './notifications'
import {
	create_post,
	delete_post,
	get_post_or_404,
	get_visible_post,
	list_feed,
	list_posts_by_user,
	search_posts,
	update_post,
} from './posts'
import { search_all, search_users } from './search'
import { find_user_by_handle, require_user_by_handle } from './users'
import { create_test_db, make_follow, make_user } from './test-db'

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

// ---------------------------------------------------------------------------
// 1. Anonymous access to public vs. followers-only posts
// ---------------------------------------------------------------------------
describe('anonymous access', () => {
	it('can view public posts but not followers-only posts', async () => {
		const pub = await create_post(db, alice, { content: 'public hello' })
		const priv = await create_post(db, alice, {
			content: 'followers only',
			visibility: 'followers-only',
		})

		expect(await get_visible_post(db, null, pub.id)).not.toBeNull()
		expect(await get_visible_post(db, null, priv.id)).toBeNull()
	})

	it('sees only public posts in the global feed', async () => {
		await create_post(db, alice, { content: 'public' })
		await create_post(db, alice, { content: 'secret', visibility: 'followers-only' })
		const feed = await list_feed(db, null, { limit: 50 })
		expect(feed.items.every((p) => p.visibility === 'public')).toBe(true)
	})

	it('gets empty following feed', async () => {
		await create_post(db, alice, { content: 'something' })
		const feed = await list_feed(db, null, { feed: 'following' })
		expect(feed.items).toHaveLength(0)
	})

	it('cannot see followers-only posts in search results', async () => {
		await create_post(db, alice, { content: 'searchable needle public' })
		await create_post(db, alice, {
			content: 'searchable needle secret',
			visibility: 'followers-only',
		})
		const results = await search_posts(db, null, 'searchable needle')
		expect(results.items).toHaveLength(1)
		expect(results.items[0].visibility).toBe('public')
	})

	it('returns 404 for followers-only post via get_post_or_404', async () => {
		const priv = await create_post(db, alice, { content: 'nope', visibility: 'followers-only' })
		expect(await status_of(get_post_or_404(db, null, priv.id))).toBe(404)
	})

	it('cannot list comments on a followers-only post', async () => {
		const priv = await create_post(db, alice, {
			content: 'secret post',
			visibility: 'followers-only',
		})
		await create_comment(db, alice, priv.id, { content: 'author comment' })
		expect(await status_of(list_comments(db, null, priv.id))).toBe(404)
	})

	it('can view user profiles, followers, and following lists', async () => {
		await make_follow(db, bob, alice)
		const profile = await build_profile(db, null, {
			id: alice,
			name: 'Alice',
			username: 'alice',
			image: null,
			createdAt: new Date(),
		})
		expect(profile.user.id).toBe(alice)
		expect(profile.is_self).toBe(false)
		expect(profile.is_following).toBe(false)

		const followers = await list_followers(db, null, alice)
		expect(followers.items).toHaveLength(1)

		const following = await list_following(db, null, alice)
		expect(following.items).toHaveLength(0)
	})

	it('can search users without authentication', async () => {
		const results = await search_users(db, null, 'alice')
		expect(results.map((u) => u.id)).toContain(alice)
	})

	it('can view public posts on a user profile page', async () => {
		await create_post(db, alice, { content: 'public on profile' })
		await create_post(db, alice, { content: 'secret on profile', visibility: 'followers-only' })
		const posts = await list_posts_by_user(db, null, alice)
		expect(posts.items).toHaveLength(1)
		expect(posts.items[0].visibility).toBe('public')
	})
})

// ---------------------------------------------------------------------------
// 2. Non-owner post/comment modification
// ---------------------------------------------------------------------------
describe('non-owner modification', () => {
	it("cannot edit another user's post", async () => {
		const p = await create_post(db, alice, { content: 'alice post' })
		expect(await status_of(update_post(db, bob, p.id, { content: 'hijacked' }))).toBe(403)
	})

	it("cannot delete another user's post", async () => {
		const p = await create_post(db, alice, { content: 'alice post' })
		expect(await status_of(delete_post(db, bob, p.id))).toBe(403)
	})

	it("cannot edit another user's comment", async () => {
		const p = await create_post(db, alice, { content: 'post' })
		const c = await create_comment(db, bob, p.id, { content: 'bob comment' })
		expect(await status_of(update_comment(db, carol, c.id, { content: 'hacked' }))).toBe(403)
	})

	it("cannot delete another user's comment", async () => {
		const p = await create_post(db, alice, { content: 'post' })
		const c = await create_comment(db, bob, p.id, { content: 'bob comment' })
		expect(await status_of(delete_comment(db, carol, c.id))).toBe(403)
	})

	it('returns 404 (not 403) when trying to modify a followers-only post by a non-follower', async () => {
		const p = await create_post(db, alice, { content: 'hidden', visibility: 'followers-only' })
		// Non-follower should get 404 (not leak existence)
		expect(await status_of(update_post(db, bob, p.id, { content: 'x' }))).toBe(404)
		expect(await status_of(delete_post(db, bob, p.id))).toBe(404)
	})

	it('owner can edit and delete their own post', async () => {
		const p = await create_post(db, alice, { content: 'original' })
		const edited = await update_post(db, alice, p.id, { content: 'updated' })
		expect(edited.content).toBe('updated')
		await delete_post(db, alice, p.id)
		expect(await get_visible_post(db, alice, p.id)).toBeNull()
	})

	it('owner can edit and delete their own comment', async () => {
		const p = await create_post(db, alice, { content: 'post' })
		const c = await create_comment(db, bob, p.id, { content: 'original' })
		const edited = await update_comment(db, bob, c.id, { content: 'revised' })
		expect(edited.content).toBe('revised')
		await delete_comment(db, bob, c.id)
		const comments = await list_comments(db, bob, p.id)
		expect(comments).toHaveLength(0)
	})
})

// ---------------------------------------------------------------------------
// 3. Notification isolation between users
// ---------------------------------------------------------------------------
describe('notification isolation', () => {
	it("users cannot see each other's notifications", async () => {
		const p = await create_post(db, alice, { content: 'notify me' })
		await like_post(db, bob, p.id)
		await follow_user(db, carol, alice)

		// Alice has 2 notifications (like + follow)
		expect(await unread_count(db, alice)).toBe(2)
		const alice_notifs = await list_notifications(db, alice)
		expect(alice_notifs.items).toHaveLength(2)

		// Bob and Carol have 0 notifications
		expect(await unread_count(db, bob)).toBe(0)
		expect((await list_notifications(db, bob)).items).toHaveLength(0)
		expect(await unread_count(db, carol)).toBe(0)
		expect((await list_notifications(db, carol)).items).toHaveLength(0)
	})

	it("cannot mark another user's notification as read", async () => {
		const p = await create_post(db, alice, { content: 'x' })
		await like_post(db, bob, p.id)
		const [notif] = (await list_notifications(db, alice)).items
		// Carol tries to mark Alice's notification
		expect(await status_of(mark_read(db, carol, notif.id))).toBe(404)
		// Alice can mark her own
		expect((await mark_read(db, alice, notif.id)).unread_count).toBe(0)
	})

	it('no self-notifications for own actions', async () => {
		const p = await create_post(db, alice, { content: 'self' })
		await like_post(db, alice, p.id)
		await create_comment(db, alice, p.id, { content: 'self comment' })
		expect(await unread_count(db, alice)).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// 4. Follow/unfollow authorization
// ---------------------------------------------------------------------------
describe('follow/unfollow authorization', () => {
	it('cannot follow yourself', async () => {
		expect(await status_of(follow_user(db, alice, alice))).toBe(400)
	})

	it('cannot unfollow yourself', async () => {
		expect(await status_of(unfollow_user(db, alice, alice))).toBe(400)
	})

	it('cannot follow a non-existent user', async () => {
		expect(await status_of(follow_user(db, alice, 'ghost-id'))).toBe(404)
	})

	it('follow is idempotent and does not duplicate', async () => {
		await follow_user(db, alice, bob)
		const result = await follow_user(db, alice, bob)
		expect(result.follower_count).toBe(1)
	})

	it('unfollow is idempotent', async () => {
		await follow_user(db, alice, bob)
		await unfollow_user(db, alice, bob)
		const result = await unfollow_user(db, alice, bob)
		expect(result.follower_count).toBe(0)
	})

	it('following someone grants access to their followers-only posts', async () => {
		const priv = await create_post(db, alice, {
			content: 'inner circle',
			visibility: 'followers-only',
		})
		expect(await get_visible_post(db, bob, priv.id)).toBeNull()
		await follow_user(db, bob, alice)
		expect(await get_visible_post(db, bob, priv.id)).not.toBeNull()
	})

	it('unfollowing revokes access to followers-only posts', async () => {
		const priv = await create_post(db, alice, {
			content: 'inner circle',
			visibility: 'followers-only',
		})
		await follow_user(db, bob, alice)
		expect(await get_visible_post(db, bob, priv.id)).not.toBeNull()
		await unfollow_user(db, bob, alice)
		expect(await get_visible_post(db, bob, priv.id)).toBeNull()
	})

	it('following in the wrong direction grants nothing', async () => {
		const priv = await create_post(db, alice, {
			content: 'restricted',
			visibility: 'followers-only',
		})
		await follow_user(db, alice, bob) // alice follows bob, NOT bob follows alice
		expect(await get_visible_post(db, bob, priv.id)).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// 5. Access to hidden/private posts through permalink/API routes
// ---------------------------------------------------------------------------
describe('hidden post access through various paths', () => {
	let secret_id: string

	beforeEach(async () => {
		const p = await create_post(db, alice, {
			content: 'locked content',
			visibility: 'followers-only',
		})
		secret_id = p.id
	})

	it('direct view (get_visible_post) returns null for non-followers', async () => {
		expect(await get_visible_post(db, bob, secret_id)).toBeNull()
		expect(await get_visible_post(db, null, secret_id)).toBeNull()
	})

	it('get_post_or_404 returns 404 for non-followers', async () => {
		expect(await status_of(get_post_or_404(db, bob, secret_id))).toBe(404)
		expect(await status_of(get_post_or_404(db, null, secret_id))).toBe(404)
	})

	it('author always sees their own followers-only post', async () => {
		expect(await get_visible_post(db, alice, secret_id)).not.toBeNull()
	})

	it('global feed never includes followers-only posts', async () => {
		const feed = await list_feed(db, alice, { limit: 50, feed: 'global' })
		expect(feed.items.some((p) => p.id === secret_id)).toBe(false)
	})

	it('following feed includes followers-only posts from followed users', async () => {
		await follow_user(db, bob, alice)
		const feed = await list_feed(db, bob, { feed: 'following', limit: 50 })
		expect(feed.items.some((p) => p.id === secret_id)).toBe(true)
	})

	it('profile post list respects visibility', async () => {
		const non_follower = await list_posts_by_user(db, bob, alice)
		expect(non_follower.items.some((p) => p.id === secret_id)).toBe(false)

		await follow_user(db, bob, alice)
		const follower = await list_posts_by_user(db, bob, alice)
		expect(follower.items.some((p) => p.id === secret_id)).toBe(true)
	})

	it('search results respect visibility', async () => {
		const anon_results = await search_posts(db, null, 'locked content')
		expect(anon_results.items).toHaveLength(0)

		const non_follower_results = await search_posts(db, bob, 'locked content')
		expect(non_follower_results.items).toHaveLength(0)

		await follow_user(db, bob, alice)
		const follower_results = await search_posts(db, bob, 'locked content')
		expect(follower_results.items).toHaveLength(1)
	})

	it('search_all never returns followers-only posts to non-followers', async () => {
		const results = await search_all(db, bob, 'locked')
		expect(results.posts).toHaveLength(0)
	})

	it('like/unlike returns 404 for invisible posts', async () => {
		expect(await status_of(like_post(db, bob, secret_id))).toBe(404)
	})

	it('comment creation returns 404 for invisible posts', async () => {
		expect(await status_of(create_comment(db, bob, secret_id, { content: 'hi' }))).toBe(404)
	})

	it('comment listing returns 404 for invisible posts', async () => {
		expect(await status_of(list_comments(db, bob, secret_id))).toBe(404)
	})
})

// ---------------------------------------------------------------------------
// 6. Profile/follower/following visibility
// ---------------------------------------------------------------------------
describe('profile visibility', () => {
	it('profile shows correct is_self, is_following, is_followed_by for different viewers', async () => {
		await follow_user(db, alice, bob)
		await follow_user(db, bob, alice)

		const target = {
			id: alice,
			name: 'Alice',
			username: 'alice',
			image: null,
			createdAt: new Date(),
		}

		// Alice views her own profile
		const self_profile = await build_profile(db, alice, target)
		expect(self_profile.is_self).toBe(true)
		expect(self_profile.is_following).toBe(false) // is_following check skips self

		// Bob views Alice's profile (mutual follow)
		const bob_profile = await build_profile(db, bob, target)
		expect(bob_profile.is_self).toBe(false)
		expect(bob_profile.is_following).toBe(true)
		expect(bob_profile.is_followed_by).toBe(true)

		// Carol views Alice's profile (no relationship)
		const carol_profile = await build_profile(db, carol, target)
		expect(carol_profile.is_self).toBe(false)
		expect(carol_profile.is_following).toBe(false)
		expect(carol_profile.is_followed_by).toBe(false)

		// Anonymous viewer
		const anon_profile = await build_profile(db, null, target)
		expect(anon_profile.is_self).toBe(false)
		expect(anon_profile.is_following).toBe(false)
	})

	it('follower/following lists are visible to all viewers', async () => {
		await follow_user(db, alice, bob)
		await follow_user(db, carol, bob)

		// Anonymous can see bob's followers
		const followers = await list_followers(db, null, bob)
		expect(followers.items).toHaveLength(2)
		const follower_ids = followers.items.map((u) => u.id)
		expect(follower_ids).toContain(alice)
		expect(follower_ids).toContain(carol)

		// Anonymous can see bob's following list (empty)
		const following = await list_following(db, null, bob)
		expect(following.items).toHaveLength(0)

		// Third party can see follower lists with relationship indicators
		const carol_view = await list_followers(db, carol, bob)
		const alice_in_list = carol_view.items.find((u) => u.id === alice)
		expect(alice_in_list).toBeDefined()
	})

	it('find_user_by_handle works by username and id', async () => {
		const by_username = await find_user_by_handle(db, 'alice')
		expect(by_username?.id).toBe(alice)

		const by_id = await find_user_by_handle(db, alice)
		expect(by_id?.id).toBe(alice)

		const missing = await find_user_by_handle(db, 'nonexistent')
		expect(missing).toBeNull()
	})

	it('require_user_by_handle throws 404 for missing users', async () => {
		expect(await status_of(require_user_by_handle(db, 'ghost'))).toBe(404)
	})
})
