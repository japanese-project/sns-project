/**
 * Endpoint-level authorization tests.
 *
 * Unlike src/lib/server/services/authorization.spec.ts (which calls service functions
 * directly), these invoke the real SvelteKit route handlers (`+server.ts` / `+page.server.ts`)
 * the way the framework does, so they also cover the wiring that the services can't:
 * `require_user_id` -> 401, handle resolution, and which status a thrown HttpError becomes.
 *
 * What is real: the route handlers, the services, and a D1 database with the actual
 * migrations (constraints, FK cascades). What is simulated: `event.locals.user`, which is
 * normally populated by hooks.server.ts from the Better Auth session. Session resolution
 * itself is not exercised here.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- response bodies are arbitrary JSON */
import { isHttpError, isRedirect } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '$lib/server/db'
import { comment, follow, like, notification, post, user } from '$lib/server/db/schema'
import { create_comment } from '$lib/server/services/comments'
import { follow_user } from '$lib/server/services/follows'
import { like_post } from '$lib/server/services/likes'
import { create_post } from '$lib/server/services/posts'
import { create_test_db, make_user } from '$lib/server/services/test-db'
import { MAX_PAGE_SIZE, MAX_SUGGESTION_LIMIT, MAX_TRENDING_LIMIT } from '$lib/limits'

import { load as home_load } from '../+page.server'
import { load as explore_load } from '../explore/+page.server'
import { load as notifications_page_load } from '../notifications/+page.server'
import { load as permalink_load } from '../posts/[id]/+page.server'
import { load as profile_redirect_load } from '../profile/+page.server'
import { load as profile_load } from '../u/[handle]/+page.server'
import { load as followers_page_load } from '../u/[handle]/followers/+page.server'
import { load as following_page_load } from '../u/[handle]/following/+page.server'
import * as comment_api from './comments/[id]/+server'
import * as notifications_read_api from './notifications/read/+server'
import * as notifications_api from './notifications/+server'
import * as unread_count_api from './notifications/unread-count/+server'
import * as post_comments_api from './posts/[id]/comments/+server'
import * as post_like_api from './posts/[id]/like/+server'
import * as post_api from './posts/[id]/+server'
import * as posts_api from './posts/+server'
import * as search_api from './search/+server'
import * as suggestions_interests_api from './suggestions/users/interests/+server'
import * as suggestions_api from './suggestions/users/+server'
import * as trending_api from './trending/+server'
import * as follow_api from './users/[handle]/follow/+server'
import * as followers_api from './users/[handle]/followers/+server'
import * as following_api from './users/[handle]/following/+server'
import * as user_posts_api from './users/[handle]/posts/+server'
import * as me_api from './users/me/+server'
import * as onboard_api from './users/onboard/+server'

type Handler = (event: never) => unknown
interface Call {
	/**
	 * The signed-in user's id, or null for a request with no session. Required, so every call
	 * states its viewer. In production the hook rejects session-less requests before a handler
	 * runs; null here checks that handlers refuse them on their own as well.
	 */
	as: string | null
	params?: Record<string, string>
	query?: string
	method?: string
	body?: unknown
}
interface Result {
	status: number
	body: any
}

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

/** Runs a handler/load like SvelteKit would and normalises the outcome to {status, body}. */
async function call(handler: Handler, opts: Call): Promise<Result> {
	const url = new URL(`http://localhost/api${opts.query ? `?${opts.query}` : ''}`)
	const has_body = opts.body !== undefined
	const request = new Request(url, {
		method: opts.method ?? 'GET',
		headers: has_body ? { 'content-type': 'application/json' } : undefined,
		body: has_body ? JSON.stringify(opts.body) : undefined,
	})
	const event = {
		locals: { db, user: opts.as ? { id: opts.as } : null, session: null },
		params: opts.params ?? {},
		url,
		request,
	}
	try {
		const out = await handler(event as never)
		if (out instanceof Response) {
			const text = await out.text()
			return { status: out.status, body: text ? JSON.parse(text) : null }
		}
		return { status: 200, body: out }
	} catch (e) {
		if (isHttpError(e)) return { status: e.status, body: e.body }
		if (isRedirect(e)) return { status: e.status, body: { location: e.location } }
		throw e
	}
}

const ids = (items: { id: string }[]) => items.map((item) => item.id)

// ---------------------------------------------------------------------------
// Signed-in users only
// ---------------------------------------------------------------------------
describe('requests without a session', () => {
	it('are rejected with 401 by every API handler, reads included', async () => {
		const p = await create_post(db, alice, { content: 'public post' })
		const c = await create_comment(db, bob, p.id, { content: 'a comment' })
		const api_routes: [string, Handler, Omit<Call, 'as'>][] = [
			// reads
			['GET /api/posts', posts_api.GET, {}],
			['GET /api/posts?feed=following', posts_api.GET, { query: 'feed=following' }],
			['GET /api/posts/:id', post_api.GET, { params: { id: p.id } }],
			['GET /api/posts/:id/comments', post_comments_api.GET, { params: { id: p.id } }],
			['GET /api/search', search_api.GET, { query: 'q=public' }],
			['GET /api/trending', trending_api.GET, {}],
			['GET /api/suggestions/users', suggestions_api.GET, {}],
			[
				'GET /api/suggestions/users/interests',
				suggestions_interests_api.GET,
				{ query: 'interests=a' },
			],
			['GET /api/users/:handle/posts', user_posts_api.GET, { params: { handle: 'alice' } }],
			['GET /api/users/:handle/followers', followers_api.GET, { params: { handle: 'alice' } }],
			['GET /api/users/:handle/following', following_api.GET, { params: { handle: 'alice' } }],
			['GET /api/notifications', notifications_api.GET, {}],
			['GET /api/notifications/unread-count', unread_count_api.GET, {}],
			// writes
			['POST /api/posts', posts_api.POST, { method: 'POST', body: { content: 'hi' } }],
			[
				'PATCH /api/posts/:id',
				post_api.PATCH,
				{ method: 'PATCH', params: { id: p.id }, body: { content: 'x' } },
			],
			['DELETE /api/posts/:id', post_api.DELETE, { method: 'DELETE', params: { id: p.id } }],
			[
				'POST /api/posts/:id/comments',
				post_comments_api.POST,
				{ method: 'POST', params: { id: p.id }, body: { content: 'x' } },
			],
			['PUT /api/posts/:id/like', post_like_api.PUT, { method: 'PUT', params: { id: p.id } }],
			[
				'DELETE /api/posts/:id/like',
				post_like_api.DELETE,
				{ method: 'DELETE', params: { id: p.id } },
			],
			[
				'PATCH /api/comments/:id',
				comment_api.PATCH,
				{ method: 'PATCH', params: { id: c.id }, body: { content: 'x' } },
			],
			['DELETE /api/comments/:id', comment_api.DELETE, { method: 'DELETE', params: { id: c.id } }],
			['POST /api/notifications/read', notifications_read_api.POST, { method: 'POST' }],
			[
				'PUT /api/users/:handle/follow',
				follow_api.PUT,
				{ method: 'PUT', params: { handle: 'bob' } },
			],
			[
				'DELETE /api/users/:handle/follow',
				follow_api.DELETE,
				{ method: 'DELETE', params: { handle: 'bob' } },
			],
			['PATCH /api/users/me', me_api.PATCH, { method: 'PATCH', body: { name: 'x' } }],
			['POST /api/users/onboard', onboard_api.POST, { method: 'POST', body: { skip: true } }],
		]
		for (const [label, handler, opts] of api_routes) {
			const { status } = await call(handler, { ...opts, as: null })
			expect({ label, status }).toEqual({ label, status: 401 })
		}
	})

	it('are redirected to /login by every page load', async () => {
		const p = await create_post(db, alice, { content: 'public post' })
		const pages: [string, Handler, Omit<Call, 'as'>][] = [
			['/', home_load as Handler, {}],
			['/explore', explore_load as Handler, {}],
			['/notifications', notifications_page_load as Handler, {}],
			['/profile', profile_redirect_load as Handler, {}],
			['/u/:handle', profile_load as Handler, { params: { handle: 'alice' } }],
			['/u/:handle/followers', followers_page_load as Handler, { params: { handle: 'alice' } }],
			['/u/:handle/following', following_page_load as Handler, { params: { handle: 'alice' } }],
			['/posts/:id', permalink_load as Handler, { params: { id: p.id } }],
		]
		for (const [label, load, opts] of pages) {
			const res = await call(load, { ...opts, as: null })
			expect({ label, status: res.status, location: res.body.location }).toEqual({
				label,
				status: 302,
				location: '/login',
			})
		}
	})

	it('are redirected before the target is looked up, so a missing page is not revealed', async () => {
		// Unknown handle/post: still a redirect to /login, never a 404 that a visitor could probe.
		const res = await call(profile_load as Handler, {
			as: null,
			params: { handle: 'no-such-user' },
		})
		expect(res.status).toBe(302)
	})
})

describe('signed-in non-followers', () => {
	it('can read public posts but get 404 (not 403) for followers-only ones', async () => {
		const pub = await create_post(db, alice, { content: 'hello world' })
		const priv = await create_post(db, alice, {
			content: 'inner circle',
			visibility: 'followers-only',
		})

		const ok = await call(post_api.GET, { as: bob, params: { id: pub.id } })
		expect(ok.status).toBe(200)
		expect(ok.body.content).toBe('hello world')

		// 404 rather than 403, so the existence of a private post isn't revealed.
		expect((await call(post_api.GET, { as: bob, params: { id: priv.id } })).status).toBe(404)
	})

	it('see only public posts in the global feed, and an empty following feed', async () => {
		const pub = await create_post(db, alice, { content: 'public' })
		const priv = await create_post(db, alice, { content: 'secret', visibility: 'followers-only' })

		const global = await call(posts_api.GET, { as: bob })
		expect(global.status).toBe(200)
		expect(ids(global.body.items)).toContain(pub.id)
		expect(ids(global.body.items)).not.toContain(priv.id)

		const following = await call(posts_api.GET, { as: bob, query: 'feed=following' })
		expect(following.status).toBe(200)
		expect(following.body.items).toEqual([])
	})

	it('can read public comments but not comments on a followers-only post', async () => {
		const pub = await create_post(db, alice, { content: 'public' })
		const priv = await create_post(db, alice, { content: 'secret', visibility: 'followers-only' })
		await create_comment(db, carol, pub.id, { content: 'visible' })
		await create_comment(db, alice, priv.id, { content: 'hidden' })

		const ok = await call(post_comments_api.GET, { as: bob, params: { id: pub.id } })
		expect(ok.status).toBe(200)
		expect(ok.body.items).toHaveLength(1)
		expect((await call(post_comments_api.GET, { as: bob, params: { id: priv.id } })).status).toBe(
			404,
		)
	})
})

// ---------------------------------------------------------------------------
// Non-owner modification
// ---------------------------------------------------------------------------
describe('non-owner post and comment modification', () => {
	it("returns 403 and leaves the post intact when editing or deleting someone else's post", async () => {
		const p = await create_post(db, alice, { content: 'alice original' })

		const edit = await call(post_api.PATCH, {
			as: bob,
			method: 'PATCH',
			params: { id: p.id },
			body: { content: 'hijacked' },
		})
		const remove = await call(post_api.DELETE, { as: bob, method: 'DELETE', params: { id: p.id } })
		expect([edit.status, remove.status]).toEqual([403, 403])

		const after = await call(post_api.GET, { as: alice, params: { id: p.id } })
		expect(after.body.content).toBe('alice original')
	})

	it('lets the owner edit then delete their own post', async () => {
		const p = await create_post(db, alice, { content: 'v1' })
		const edit = await call(post_api.PATCH, {
			as: alice,
			method: 'PATCH',
			params: { id: p.id },
			body: { content: 'v2' },
		})
		expect(edit.status).toBe(200)
		expect(edit.body.content).toBe('v2')

		const remove = await call(post_api.DELETE, {
			as: alice,
			method: 'DELETE',
			params: { id: p.id },
		})
		expect(remove.status).toBe(204)
		expect((await call(post_api.GET, { as: alice, params: { id: p.id } })).status).toBe(404)
	})

	it("returns 403 and leaves the comment intact when editing or deleting someone else's comment", async () => {
		const p = await create_post(db, alice, { content: 'post' })
		const c = await create_comment(db, bob, p.id, { content: 'bob says' })

		// Neither carol (bystander) nor alice (the post's author) may touch bob's comment.
		for (const intruder of [carol, alice]) {
			const edit = await call(comment_api.PATCH, {
				as: intruder,
				method: 'PATCH',
				params: { id: c.id },
				body: { content: 'hacked' },
			})
			const remove = await call(comment_api.DELETE, {
				as: intruder,
				method: 'DELETE',
				params: { id: c.id },
			})
			expect({ intruder, statuses: [edit.status, remove.status] }).toEqual({
				intruder,
				statuses: [403, 403],
			})
		}
		const still = await call(post_comments_api.GET, { as: alice, params: { id: p.id } })
		expect(still.body.items.map((x: { content: string }) => x.content)).toEqual(['bob says'])
	})

	it('lets the comment author edit then delete it', async () => {
		const p = await create_post(db, alice, { content: 'post' })
		const c = await create_comment(db, bob, p.id, { content: 'first' })
		const edit = await call(comment_api.PATCH, {
			as: bob,
			method: 'PATCH',
			params: { id: c.id },
			body: { content: 'second' },
		})
		expect(edit.status).toBe(200)
		expect(edit.body.content).toBe('second')
		const remove = await call(comment_api.DELETE, {
			as: bob,
			method: 'DELETE',
			params: { id: c.id },
		})
		expect(remove.status).toBe(204)
	})

	it('returns 404 (not 403) when a non-follower targets a followers-only post', async () => {
		const priv = await create_post(db, alice, { content: 'hidden', visibility: 'followers-only' })
		const edit = await call(post_api.PATCH, {
			as: bob,
			method: 'PATCH',
			params: { id: priv.id },
			body: { content: 'x' },
		})
		const remove = await call(post_api.DELETE, {
			as: bob,
			method: 'DELETE',
			params: { id: priv.id },
		})
		expect([edit.status, remove.status]).toEqual([404, 404])
	})

	it('returns 404 for unknown posts and comments', async () => {
		const missing_post = await call(post_api.PATCH, {
			as: alice,
			method: 'PATCH',
			params: { id: 'nope' },
			body: { content: 'x' },
		})
		const missing_comment = await call(comment_api.DELETE, {
			as: alice,
			method: 'DELETE',
			params: { id: 'nope' },
		})
		expect([missing_post.status, missing_comment.status]).toEqual([404, 404])
	})
})

// ---------------------------------------------------------------------------
// Notification isolation
// ---------------------------------------------------------------------------
describe('notification isolation', () => {
	async function seed_alice_notifications() {
		const p = await create_post(db, alice, { content: 'notify me' })
		await like_post(db, bob, p.id)
		await follow_user(db, carol, alice)
	}

	it("only returns the signed-in user's own notifications", async () => {
		await seed_alice_notifications()

		const mine = await call(notifications_api.GET, { as: alice })
		expect(mine.status).toBe(200)
		expect(mine.body.items).toHaveLength(2)
		expect(mine.body.unread_count).toBe(2)

		for (const other of [bob, carol]) {
			const theirs = await call(notifications_api.GET, { as: other })
			const count = await call(unread_count_api.GET, { as: other })
			expect({ other, items: theirs.body.items.length, unread: count.body.unread_count }).toEqual({
				other,
				items: 0,
				unread: 0,
			})
		}
	})

	it("cannot mark another user's notification as read", async () => {
		await seed_alice_notifications()
		const [first] = (await call(notifications_api.GET, { as: alice })).body.items

		const attempt = await call(notifications_read_api.POST, {
			as: carol,
			method: 'POST',
			body: { id: first.id },
		})
		expect(attempt.status).toBe(404)

		const after = await call(unread_count_api.GET, { as: alice })
		expect(after.body.unread_count).toBe(2)
	})

	it('lets the recipient mark exactly one of their own notifications as read', async () => {
		await seed_alice_notifications()
		const [first] = (await call(notifications_api.GET, { as: alice })).body.items

		const res = await call(notifications_read_api.POST, {
			as: alice,
			method: 'POST',
			body: { id: first.id },
		})
		expect(res.status).toBe(200)
		expect(res.body.unread_count).toBe(1)
	})

	it("'mark all read' only affects the caller's notifications", async () => {
		await seed_alice_notifications()

		const by_carol = await call(notifications_read_api.POST, { as: carol, method: 'POST' })
		expect(by_carol.status).toBe(200)
		expect((await call(unread_count_api.GET, { as: alice })).body.unread_count).toBe(2)

		const by_alice = await call(notifications_read_api.POST, { as: alice, method: 'POST' })
		expect(by_alice.body.unread_count).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// Follow / unfollow
// ---------------------------------------------------------------------------
describe('follow and unfollow', () => {
	const put = (as: string | null, handle: string) =>
		call(follow_api.PUT, { as, method: 'PUT', params: { handle } })
	const del = (as: string | null, handle: string) =>
		call(follow_api.DELETE, { as, method: 'DELETE', params: { handle } })

	it('rejects following or unfollowing yourself with 400', async () => {
		expect((await put(alice, 'alice')).status).toBe(400)
		expect((await del(alice, 'alice')).status).toBe(400)
	})

	it('returns 404 for an unknown handle', async () => {
		expect((await put(alice, 'ghost')).status).toBe(404)
		expect((await del(alice, 'ghost')).status).toBe(404)
	})

	it('resolves the target by username or by id, and is idempotent', async () => {
		expect((await put(alice, 'bob')).body.follower_count).toBe(1)
		expect((await put(alice, bob)).body.follower_count).toBe(1)
		expect((await del(alice, 'bob')).body.follower_count).toBe(0)
		expect((await del(alice, bob)).body.follower_count).toBe(0)
	})

	it('only ever acts as the signed-in user', async () => {
		await put(bob, 'alice')
		const followers = await call(followers_api.GET, { as: carol, params: { handle: 'alice' } })
		expect(ids(followers.body.items)).toEqual([bob])
	})

	it('grants and revokes access to followers-only posts, in one direction only', async () => {
		const priv = await create_post(db, alice, {
			content: 'inner circle',
			visibility: 'followers-only',
		})
		const read_as_bob = () => call(post_api.GET, { as: bob, params: { id: priv.id } })

		expect((await read_as_bob()).status).toBe(404)
		await put(alice, 'bob') // alice following bob grants bob nothing
		expect((await read_as_bob()).status).toBe(404)

		await put(bob, 'alice')
		expect((await read_as_bob()).status).toBe(200)

		await del(bob, 'alice')
		expect((await read_as_bob()).status).toBe(404)
	})
})

// ---------------------------------------------------------------------------
// Hidden / private posts through every API and page route
// ---------------------------------------------------------------------------
describe('followers-only posts are hidden on every route', () => {
	let secret: string
	beforeEach(async () => {
		secret = (
			await create_post(db, alice, {
				content: 'locked #secrettag content',
				visibility: 'followers-only',
			})
		).id
	})

	it('permalink: API and page load agree (404 for a non-follower)', async () => {
		const api = await call(post_api.GET, { as: bob, params: { id: secret } })
		const page = await call(permalink_load as Handler, { as: bob, params: { id: secret } })
		expect({ api: api.status, page: page.status }).toEqual({ api: 404, page: 404 })
	})

	it('permalink: followers and the author can read it', async () => {
		await follow_user(db, bob, alice)
		for (const as of [bob, alice]) {
			const api = await call(post_api.GET, { as, params: { id: secret } })
			const page = await call(permalink_load as Handler, { as, params: { id: secret } })
			expect({ as, api: api.status, page: page.status }).toEqual({ as, api: 200, page: 200 })
		}
	})

	it('cannot be commented on, liked or un-liked by a non-follower', async () => {
		const attempts = [
			await call(post_comments_api.GET, { as: bob, params: { id: secret } }),
			await call(post_comments_api.POST, {
				as: bob,
				method: 'POST',
				params: { id: secret },
				body: { content: 'hi' },
			}),
			await call(post_like_api.PUT, { as: bob, method: 'PUT', params: { id: secret } }),
			await call(post_like_api.DELETE, { as: bob, method: 'DELETE', params: { id: secret } }),
		]
		expect(attempts.map((r) => r.status)).toEqual([404, 404, 404, 404])
	})

	it("is filtered out of the author's post list for a non-follower", async () => {
		const public_post = await create_post(db, alice, { content: 'public one' })
		const as_stranger = await call(user_posts_api.GET, { as: bob, params: { handle: 'alice' } })
		expect(ids(as_stranger.body.items)).toEqual([public_post.id])
		await follow_user(db, bob, alice)
		const as_follower = await call(user_posts_api.GET, { as: bob, params: { handle: 'alice' } })
		expect(ids(as_follower.body.items)).toContain(secret)
		const as_author = await call(user_posts_api.GET, { as: alice, params: { handle: 'alice' } })
		expect(ids(as_author.body.items)).toContain(secret)
	})

	it('is not returned by search unless the viewer follows the author', async () => {
		const before = await call(search_api.GET, { as: bob, query: 'q=locked' })
		expect(before.body.posts).toEqual([])
		await follow_user(db, bob, alice)
		const res = await call(search_api.GET, { as: bob, query: 'q=locked' })
		expect(ids(res.body.posts)).toEqual([secret])
	})

	it('only shows in the following feed while the viewer follows the author', async () => {
		const feed = () => call(posts_api.GET, { as: bob, query: 'feed=following' })
		expect((await feed()).body.items).toEqual([])
		await follow_user(db, bob, alice)
		expect(ids((await feed()).body.items)).toEqual([secret])
	})

	it('never leaks into the public global feed or into trending hashtags', async () => {
		await create_post(db, alice, { content: 'shout #publictag' })
		await follow_user(db, bob, alice)

		const feed = await call(posts_api.GET, { as: bob })
		expect(ids(feed.body.items)).not.toContain(secret)

		const trending = await call(trending_api.GET, { as: bob, query: 'period=month' })
		const tags = trending.body.topics.map((t: { tag: string }) => t.tag)
		expect(tags).toContain('publictag')
		expect(tags).not.toContain('secrettag')
	})
})

// ---------------------------------------------------------------------------
// Profile, follower and following visibility
// ---------------------------------------------------------------------------
describe('profile, follower and following visibility', () => {
	it('exposes follower and following lists to any signed-in viewer', async () => {
		await follow_user(db, bob, alice)
		await follow_user(db, alice, carol)

		const followers = await call(followers_api.GET, { as: carol, params: { handle: 'alice' } })
		const following = await call(following_api.GET, { as: carol, params: { handle: 'alice' } })
		expect(ids(followers.body.items)).toEqual([bob])
		expect(ids(following.body.items)).toEqual([carol])
	})

	it('returns 404 for every per-user route when the handle is unknown', async () => {
		const routes: [string, Handler][] = [
			['followers', followers_api.GET],
			['following', following_api.GET],
			['posts', user_posts_api.GET],
			['profile page', profile_load as Handler],
			['followers page', followers_page_load as Handler],
		]
		for (const [label, handler] of routes) {
			const { status } = await call(handler, { as: alice, params: { handle: 'ghost' } })
			expect({ label, status }).toEqual({ label, status: 404 })
		}
	})

	it('reports viewer-relative flags on the profile page (self, follower, stranger)', async () => {
		await follow_user(db, bob, alice)
		const view = async (as: string) =>
			(await call(profile_load as Handler, { as, params: { handle: 'alice' } })).body.profile
		expect(await view(alice)).toMatchObject({ is_self: true })
		expect(await view(bob)).toMatchObject({ is_self: false, is_following: true })
		expect(await view(carol)).toMatchObject({ is_self: false, is_following: false })
	})

	it('PATCH /api/users/me only ever edits the caller, even if the body names another id', async () => {
		const res = await call(me_api.PATCH, {
			as: bob,
			method: 'PATCH',
			body: { id: alice, name: 'Bobby', userId: alice },
		})
		expect(res.status).toBe(200)
		expect(res.body.id).toBe(bob)

		const profile = async (handle: string) =>
			(await call(profile_load as Handler, { as: alice, params: { handle } })).body.profile.user
		expect((await profile('bob')).name).toBe('Bobby')
		expect((await profile('alice')).name).toBe('Alice')
	})
})

// ---------------------------------------------------------------------------
// Input validation reached through the routes
// ---------------------------------------------------------------------------
describe('profile input validation via the API', () => {
	const patch_me = (as: string, body: unknown) => call(me_api.PATCH, { as, method: 'PATCH', body })

	it('returns 400, never 500, for a taken username', async () => {
		const res = await patch_me(bob, { username: 'alice' })
		expect(res.status).toBe(400)
		expect(res.body.message).toBe('Username is already taken')
	})

	it('returns 400 for exactly one of two simultaneous claims on the same username', async () => {
		const results = await Promise.all([
			patch_me(bob, { username: 'shared_name' }),
			patch_me(carol, { username: 'shared_name' }),
		])
		expect(results.map((r) => r.status).sort()).toEqual([200, 400])
	})

	it('rejects malformed interests on PATCH /api/users/me', async () => {
		const bad: unknown[] = [
			'music', // not an array
			['ok', 7], // non-string entry
			['x'.repeat(5000)], // oversized value
			['zero​width'], // invisible character
			['bad\x00value'], // control character
		]
		for (const interests of bad) {
			const { status } = await patch_me(bob, { interests })
			expect({ interests, status }).toEqual({ interests, status: 400 })
		}
		const ok = await patch_me(bob, { interests: ['Music', ' Art '] })
		expect(ok.status).toBe(200)
		expect(JSON.parse(ok.body.interests)).toEqual(['Music', 'Art'])
	})

	it('rejects malformed interests on onboarding and does not mark the user onboarded', async () => {
		const bad = await call(onboard_api.POST, {
			as: bob,
			method: 'POST',
			body: { name: 'Changed', interests: ['bad\x00value'] },
		})
		expect(bad.status).toBe(400)
		const row = await db.select().from(user).where(eq(user.id, bob)).get()
		expect(row?.name).toBe('Bob')
		expect(Boolean(row?.onboarded)).toBe(false)

		const ok = await call(onboard_api.POST, {
			as: bob,
			method: 'POST',
			body: { interests: ['Music'] },
		})
		expect(ok.status).toBe(200)
		expect(ok.body.onboarded).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// Public discovery endpoints: bounded work per request
// ---------------------------------------------------------------------------
describe('discovery endpoints are bounded', () => {
	it('caps suggestions regardless of a missing, non-numeric, negative or huge limit', async () => {
		for (let i = 0; i < MAX_SUGGESTION_LIMIT + 10; i++) await make_user(db, `Extra${i}`)
		const size = async (query?: string) =>
			(await call(suggestions_api.GET, { as: alice, query })).body.users.length
		expect(await size()).toBe(5)
		expect(await size('limit=abc')).toBe(5) // NaN used to remove the LIMIT entirely
		expect(await size('limit=-4')).toBe(1)
		expect(await size('limit=999999')).toBe(MAX_SUGGESTION_LIMIT)
		expect(await size('limit=Infinity')).toBe(5)
	})

	it('tolerates oversized and junk interest filters on the interest-match endpoint', async () => {
		const junk = `${'a'.repeat(5000)},,  ,${Array.from({ length: 200 }, (_, i) => `t${i}`).join(',')}`
		const res = await call(suggestions_interests_api.GET, {
			as: alice,
			query: `interests=${junk}&limit=abc`,
		})
		expect(res.status).toBe(200)
		expect(res.body.users.length).toBeLessThanOrEqual(5)
	})

	it('caps trending topics regardless of the limit', async () => {
		for (let i = 0; i < MAX_TRENDING_LIMIT + 5; i++) {
			await create_post(db, alice, { content: `post #topic${i}` })
		}
		const size = async (query: string) =>
			(await call(trending_api.GET, { as: alice, query })).body.topics.length
		expect(await size('limit=999999')).toBe(MAX_TRENDING_LIMIT)
		expect(await size('limit=abc')).toBe(8)
		expect(await size('limit=0')).toBe(1)
	})

	it('validates the search query and caps the result page size', async () => {
		expect((await call(search_api.GET, { as: alice })).status).toBe(400)
		expect((await call(search_api.GET, { as: alice, query: 'q=' })).status).toBe(400)
		expect((await call(search_api.GET, { as: alice, query: `q=${'x'.repeat(101)}` })).status).toBe(
			400,
		)
		expect((await call(search_api.GET, { as: alice, query: 'q=x&cursor=%%%' })).status).toBe(400)

		for (let i = 0; i < MAX_PAGE_SIZE + 5; i++) {
			await create_post(db, alice, { content: `findme ${i}` })
		}
		const big = await call(search_api.GET, { as: alice, query: 'q=findme&limit=999999' })
		expect(big.body.posts).toHaveLength(MAX_PAGE_SIZE)
		const junk = await call(search_api.GET, { as: alice, query: 'q=findme&limit=abc' })
		expect(junk.body.posts.length).toBeLessThanOrEqual(MAX_PAGE_SIZE)
	})
})
