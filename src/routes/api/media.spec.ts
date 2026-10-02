/* eslint-disable @typescript-eslint/no-explicit-any -- response bodies are arbitrary JSON */
import { isHttpError, isRedirect } from '@sveltejs/kit'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Db } from '$lib/server/db'
import { follow, post, user } from '$lib/server/db/schema'
import { make_follow, make_user, create_test_db } from '$lib/server/services/test-db'
import * as media_api from './media/+server'
import * as media_key_api from './media/[key]/+server'
import * as media_stats_api from './media/stats/+server'
import * as media_cleanup_api from './media/cleanup/+server'
import * as posts_api from './posts/+server'
import * as post_id_api from './posts/[id]/+server'

type Handler = (event: never) => unknown
interface Call {
	as: string | null
	params?: Record<string, string>
	query?: string
	method?: string
	body?: unknown
	formData?: FormData
	headers?: Record<string, string>
}
interface Result {
	status: number
	body: any
	response?: Response
}

let db: Db
let bucket: R2Bucket
let dispose: () => Promise<void>
let alice: string
let bob: string

beforeAll(async () => {
	;({ db, bucket, dispose } = await create_test_db())
})
afterAll(async () => {
	await dispose()
})

beforeEach(async () => {
	await db.delete(follow)
	await db.delete(post)
	await db.delete(user)
	alice = await make_user(db, 'Alice')
	bob = await make_user(db, 'Bob')
})

async function call(handler: Handler, opts: Call): Promise<Result> {
	const url = new URL(`http://localhost/api${opts.query ? `?${opts.query}` : ''}`)
	let request: Request
	const custom_headers = new Headers(opts.headers)
	if (opts.formData) {
		request = new Request(url, {
			method: opts.method ?? 'POST',
			headers: custom_headers,
			body: opts.formData,
		})
	} else {
		const has_body = opts.body !== undefined
		const method = opts.method ?? (has_body ? 'POST' : 'GET')
		if (has_body && !custom_headers.has('content-type')) {
			custom_headers.set('content-type', 'application/json')
		}
		request = new Request(url, {
			method,
			headers: custom_headers,
			body: has_body ? JSON.stringify(opts.body) : undefined,
		})
	}

	const event = {
		locals: { db, user: opts.as ? { id: opts.as } : null, session: null },
		params: opts.params ?? {},
		url,
		request,
		platform: {
			env: {
				DB: {} as D1Database,
				AUTH_KV: {} as KVNamespace,
				MEDIA_BUCKET: bucket,
				ADMIN_SECRET: 'test-admin-secret',
			},
		},
	}

	try {
		const out = await handler(event as never)
		if (out instanceof Response) {
			const text = await out.text()
			let json_body: unknown = null
			try {
				json_body = text ? JSON.parse(text) : null
			} catch {
				json_body = text
			}
			return { status: out.status, body: json_body, response: out }
		}
		return { status: 200, body: out }
	} catch (e) {
		if (isHttpError(e)) return { status: e.status, body: e.body }
		if (isRedirect(e)) return { status: e.status, body: { location: e.location } }
		throw e
	}
}

const sample_jpeg = new Uint8Array([
	0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
	0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
])

const sample_png = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
	0x89,
])

describe('Media API', () => {
	it('unauthenticated upload rejected with 401', async () => {
		const form = new FormData()
		form.append('image', new File([sample_jpeg], 'test.jpg', { type: 'image/jpeg' }))
		const res = await call(media_api.POST, { as: null, formData: form })
		expect(res.status).toBe(401)
	})

	it('authenticated image upload succeeds and sets metadata', async () => {
		const form = new FormData()
		form.append('image', new File([sample_jpeg], 'my-picture.jpeg', { type: 'image/jpeg' }))
		const res = await call(media_api.POST, { as: alice, formData: form })
		expect(res.status).toBe(201)
		expect(res.body.url).toMatch(/^\/api\/media\/[a-zA-Z0-9_-]+\.jpg$/)

		const key = res.body.url.replace('/api/media/', '')
		const head = await bucket.head(key)
		expect(head).not.toBeNull()
		expect(head?.customMetadata?.userId).toBe(alice)
	})

	it('invalid MIME type rejected with 400', async () => {
		// Disallowed type
		const text_form = new FormData()
		text_form.append('image', new File(['hello world'], 'doc.txt', { type: 'text/plain' }))
		const res1 = await call(media_api.POST, { as: alice, formData: text_form })
		expect(res1.status).toBe(400)

		// Type declared as png but content is plain text
		const spoof_form = new FormData()
		spoof_form.append(
			'image',
			new File([new TextEncoder().encode('not a real png')], 'fake.png', { type: 'image/png' }),
		)
		const res2 = await call(media_api.POST, { as: alice, formData: spoof_form })
		expect(res2.status).toBe(400)
	})

	it('oversized and empty files rejected with 400', async () => {
		// Empty file
		const empty_form = new FormData()
		empty_form.append('image', new File([], 'empty.jpg', { type: 'image/jpeg' }))
		const res1 = await call(media_api.POST, { as: alice, formData: empty_form })
		expect(res1.status).toBe(400)

		// Oversized file (> 5MB)
		const large_bytes = new Uint8Array(5 * 1024 * 1024 + 10)
		large_bytes[0] = 0xff
		large_bytes[1] = 0xd8
		large_bytes[2] = 0xff
		const large_form = new FormData()
		large_form.append('image', new File([large_bytes], 'large.jpg', { type: 'image/jpeg' }))
		const res2 = await call(media_api.POST, { as: alice, formData: large_form })
		expect(res2.status).toBe(400)
	})

	it('image-only post creation succeeds', async () => {
		const form = new FormData()
		form.append('image', new File([sample_png], 'photo.png', { type: 'image/png' }))
		const upload = await call(media_api.POST, { as: alice, formData: form })
		expect(upload.status).toBe(201)

		const post_res = await call(posts_api.POST, {
			as: alice,
			body: { content: '', imageUrl: upload.body.url },
		})
		expect(post_res.status).toBe(201)
		expect(post_res.body.content).toBe('')
		expect(post_res.body.image_url).toBe(upload.body.url)
	})

	it('followers-only image inaccessible to non-followers', async () => {
		// Alice uploads an image and creates a followers-only post
		const form = new FormData()
		form.append('image', new File([sample_jpeg], 'secret.jpg', { type: 'image/jpeg' }))
		const upload = await call(media_api.POST, { as: alice, formData: form })
		const key = upload.body.url.replace('/api/media/', '')

		await call(posts_api.POST, {
			as: alice,
			body: {
				content: 'Followers only post',
				visibility: 'followers-only',
				imageUrl: upload.body.url,
			},
		})

		// Bob (not a follower) tries to access the image
		const as_bob = await call(media_key_api.GET, { as: bob, params: { key } })
		expect(as_bob.status).toBe(404)

		// Alice (author) can access the image
		const as_alice = await call(media_key_api.GET, { as: alice, params: { key } })
		expect(as_alice.status).toBe(200)

		// Bob follows Alice -> now Bob can access the image
		await make_follow(db, bob, alice)
		const as_follower = await call(media_key_api.GET, { as: bob, params: { key } })
		expect(as_follower.status).toBe(200)
	})

	it('missing media returns 404', async () => {
		// Non-existent key
		const res1 = await call(media_key_api.GET, {
			as: alice,
			params: { key: 'nonexistent-key.jpg' },
		})
		expect(res1.status).toBe(404)

		// Media uploaded but not attached to any post
		const form = new FormData()
		form.append('image', new File([sample_jpeg], 'orphan.jpg', { type: 'image/jpeg' }))
		const upload = await call(media_api.POST, { as: alice, formData: form })
		const key = upload.body.url.replace('/api/media/', '')

		const res2 = await call(media_key_api.GET, { as: alice, params: { key } })
		expect(res2.status).toBe(404)

		// Invalid key format
		const res3 = await call(media_key_api.GET, {
			as: alice,
			params: { key: '../malicious.png' },
		})
		expect(res3.status).toBe(404)
	})

	it('validates imageUrl on post creation (external, cross-user, duplicate)', async () => {
		// External URL rejected
		const res1 = await call(posts_api.POST, {
			as: alice,
			body: { content: 'test', imageUrl: 'https://evil.com/hack.png' },
		})
		expect(res1.status).toBe(400)

		// Non-existent R2 object
		const res2 = await call(posts_api.POST, {
			as: alice,
			body: { content: 'test', imageUrl: '/api/media/00000000-0000-0000-0000-000000000000.jpg' },
		})
		expect(res2.status).toBe(400)

		// Alice uploads an image
		const form = new FormData()
		form.append('image', new File([sample_jpeg], 'pic.jpg', { type: 'image/jpeg' }))
		const upload = await call(media_api.POST, { as: alice, formData: form })

		// Bob attempts to use Alice's uploaded image
		const res3 = await call(posts_api.POST, {
			as: bob,
			body: { content: 'stolen media', imageUrl: upload.body.url },
		})
		expect(res3.status).toBe(403)

		// Alice successfully creates a post with it
		const res4 = await call(posts_api.POST, {
			as: alice,
			body: { content: 'alice post', imageUrl: upload.body.url },
		})
		expect(res4.status).toBe(201)

		// Alice attempts to attach the same media to a second post
		const res5 = await call(posts_api.POST, {
			as: alice,
			body: { content: 'second post', imageUrl: upload.body.url },
		})
		expect(res5.status).toBe(400)
	})

	it('post deletion cleans up R2 media object', async () => {
		const form = new FormData()
		form.append('image', new File([sample_jpeg], 'delete-me.jpg', { type: 'image/jpeg' }))
		const upload = await call(media_api.POST, { as: alice, formData: form })
		const key = upload.body.url.replace('/api/media/', '')

		const created = await call(posts_api.POST, {
			as: alice,
			body: { content: 'Will be deleted', imageUrl: upload.body.url },
		})
		expect(created.status).toBe(201)

		// Object exists in R2
		expect(await bucket.head(key)).not.toBeNull()

		// Delete post
		const del = await call(post_id_api.DELETE, {
			as: alice,
			method: 'DELETE',
			params: { id: created.body.id },
		})
		expect(del.status).toBe(204)

		// Object is removed from R2
		expect(await bucket.head(key)).toBeNull()
	})

	it('returns storage usage statistics via GET /api/media/stats', async () => {
		const form = new FormData()
		form.append('image', new File([sample_jpeg], 'stats-test.jpg', { type: 'image/jpeg' }))
		await call(media_api.POST, { as: alice, formData: form })

		const res = await call(media_stats_api.GET, { as: alice })
		expect(res.status).toBe(200)
		expect(res.body.total_objects).toBeGreaterThanOrEqual(1)
		expect(res.body.orphaned_objects).toBeGreaterThanOrEqual(1)
	})

	it('enforces imageUrl ownership, uniqueness and safe ordering on post update', async () => {
		// Alice creates post 1 with image 1
		const form1 = new FormData()
		form1.append('image', new File([sample_jpeg], 'post1.jpg', { type: 'image/jpeg' }))
		const upload1 = await call(media_api.POST, { as: alice, formData: form1 })
		const post1 = await call(posts_api.POST, {
			as: alice,
			body: { content: 'Post 1', imageUrl: upload1.body.url },
		})
		expect(post1.status).toBe(201)

		// Alice creates post 2 with text only
		const post2 = await call(posts_api.POST, {
			as: alice,
			body: { content: 'Post 2' },
		})
		expect(post2.status).toBe(201)

		// Alice attempts to update post 2 using image 1 (already attached to post 1)
		const dup_res = await call(post_id_api.PATCH, {
			as: alice,
			params: { id: post2.body.id },
			body: { imageUrl: upload1.body.url },
		})
		expect(dup_res.status).toBe(400)
		expect(dup_res.body.message).toBe('Media is already attached to another post')

		// Bob uploads image 2
		const form2 = new FormData()
		form2.append('image', new File([sample_jpeg], 'bob-pic.jpg', { type: 'image/jpeg' }))
		const upload2 = await call(media_api.POST, { as: bob, formData: form2 })

		// Alice attempts to update post 2 using Bob's image
		const steal_res = await call(post_id_api.PATCH, {
			as: alice,
			params: { id: post2.body.id },
			body: { imageUrl: upload2.body.url },
		})
		expect(steal_res.status).toBe(403)

		// Safe rollback ordering: Alice attempts to replace post 1 image with an invalid empty content
		const key1 = upload1.body.url.replace('/api/media/', '')
		const fail_res = await call(post_id_api.PATCH, {
			as: alice,
			params: { id: post1.body.id },
			body: { content: '   ', imageUrl: null },
		})
		expect(fail_res.status).toBe(400)
		// Previous image is NOT deleted because validation/update failed
		expect(await bucket.head(key1)).not.toBeNull()
	})

	it('cleans up orphaned media via POST /api/media/cleanup with admin authorization and validates older_than_ms', async () => {
		const form = new FormData()
		form.append('image', new File([sample_jpeg], 'orphan-cleanup.jpg', { type: 'image/jpeg' }))
		const upload = await call(media_api.POST, { as: alice, formData: form })
		const key = upload.body.url.replace('/api/media/', '')

		// Normal authenticated user without admin secret is rejected with 403 Forbidden
		const user_res = await call(media_cleanup_api.POST, {
			as: alice,
			method: 'POST',
			body: { older_than_ms: 0 },
		})
		expect(user_res.status).toBe(403)

		// Admin with negative older_than_ms is rejected with 400 Bad Request
		const neg_res = await call(media_cleanup_api.POST, {
			as: alice,
			method: 'POST',
			headers: { 'x-admin-secret': 'test-admin-secret' },
			body: { older_than_ms: -100 },
		})
		expect(neg_res.status).toBe(400)

		// Admin with non-number older_than_ms is rejected with 400 Bad Request
		const bad_type_res = await call(media_cleanup_api.POST, {
			as: alice,
			method: 'POST',
			headers: { 'x-admin-secret': 'test-admin-secret' },
			body: { older_than_ms: 'one hour' },
		})
		expect(bad_type_res.status).toBe(400)

		// Admin without specifying older_than_ms uses default safe grace period (24 hours), so newly uploaded item is NOT deleted
		const default_res = await call(media_cleanup_api.POST, {
			as: alice,
			method: 'POST',
			headers: { 'x-admin-secret': 'test-admin-secret' },
			body: {},
		})
		expect(default_res.status).toBe(200)
		expect(default_res.body.deleted_keys).not.toContain(key)
		expect(await bucket.head(key)).not.toBeNull()

		// Admin explicitly passing older_than_ms: 0 deletes orphaned objects immediately
		const res = await call(media_cleanup_api.POST, {
			as: alice,
			method: 'POST',
			headers: { 'x-admin-secret': 'test-admin-secret' },
			body: { older_than_ms: 0 },
		})
		expect(res.status).toBe(200)
		expect(res.body.deleted_count).toBeGreaterThanOrEqual(1)
		expect(res.body.deleted_keys).toContain(key)

		expect(await bucket.head(key)).toBeNull()
	})
})
