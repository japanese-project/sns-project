import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../db'
import { follow, user } from '../db/schema'
import {
	complete_onboarding,
	ensure_username,
	get_suggested_users,
	get_users_by_interests,
	update_user_profile,
} from './users'
import { create_test_db, make_follow, make_user } from './test-db'
import { MAX_INTEREST_LENGTH, MAX_SUGGESTION_LIMIT } from '$lib/limits'
import { is_unique_constraint_error } from '../validation'

let db: Db
let dispose: () => Promise<void>

beforeAll(async () => {
	;({ db, dispose } = await create_test_db())
})
afterAll(() => dispose())

beforeEach(async () => {
	await db.delete(follow)
	await db.delete(user)
})

async function status_of(promise: Promise<unknown>) {
	try {
		await promise
		return 200
	} catch (e) {
		return (e as { status?: number }).status ?? 500
	}
}

describe('update_user_profile', () => {
	it('updates display name, username, and bio', async () => {
		const id = await make_user(db, 'TestUser')
		const updated = await update_user_profile(db, id, {
			name: 'Updated Name',
			username: 'new_handle',
			bio: 'Hello world from bio!',
		})
		expect(updated.name).toBe('Updated Name')
		expect(updated.username).toBe('new_handle')
		expect(updated.handle).toBe('new_handle')
		expect(updated.bio).toBe('Hello world from bio!')
	})

	it('updates interests array when provided', async () => {
		const id = await make_user(db, 'InterestUser')
		const updated = await update_user_profile(db, id, {
			interests: ['Technology', 'Music'],
		})
		expect(updated.interests).toBe(JSON.stringify(['Technology', 'Music']))
	})

	it('rejects invalid username formats', async () => {
		const id = await make_user(db, 'ValidUser')
		// Contains spaces or special characters
		expect(await status_of(update_user_profile(db, id, { username: 'bad handle!' }))).toBe(400)
		// Too short (< 3 chars)
		expect(await status_of(update_user_profile(db, id, { username: 'ab' }))).toBe(400)
	})

	it('rejects taken username', async () => {
		await make_user(db, 'FirstUser')
		const id2 = await make_user(db, 'SecondUser')
		// firstuser username already taken
		expect(await status_of(update_user_profile(db, id2, { username: 'firstuser' }))).toBe(400)
	})

	it('rejects bio longer than 160 characters', async () => {
		const id = await make_user(db, 'BioUser')
		expect(await status_of(update_user_profile(db, id, { bio: 'a'.repeat(161) }))).toBe(400)
	})

	it('rejects interests with values exceeding the max length', async () => {
		const id = await make_user(db, 'LongInterestUser')
		const long_interest = 'a'.repeat(MAX_INTEREST_LENGTH + 1)
		expect(await status_of(update_user_profile(db, id, { interests: [long_interest] }))).toBe(400)
	})

	it('rejects interests containing control characters', async () => {
		const id = await make_user(db, 'CtrlInterestUser')
		expect(
			await status_of(update_user_profile(db, id, { interests: ['valid', 'bad\x00char'] })),
		).toBe(400)
	})

	it('trims interest values and filters out empty strings', async () => {
		const id = await make_user(db, 'TrimInterestUser')
		const updated = await update_user_profile(db, id, {
			interests: ['  Music  ', '', '  ', 'Art'],
		})
		expect(updated.interests).toBe(JSON.stringify(['Music', 'Art']))
	})

	it('caps interests at the configured maximum count', async () => {
		const id = await make_user(db, 'ManyInterestsUser')
		const many = Array.from({ length: 20 }, (_, i) => `Topic${i}`)
		const updated = await update_user_profile(db, id, { interests: many })
		const parsed = JSON.parse(updated.interests!)
		expect(parsed.length).toBeLessThanOrEqual(10)
	})
})

describe('update_user_profile: username races', () => {
	async function username_of(id: string) {
		const row = await db.select({ username: user.username }).from(user).where(eq(user.id, id)).get()
		return row?.username
	}

	it('recognises the error a real unique-index violation produces', async () => {
		await make_user(db, 'Holder') // username "holder"
		const other = await make_user(db, 'Other')
		let caught: unknown
		try {
			await db.update(user).set({ username: 'holder' }).where(eq(user.id, other))
		} catch (err) {
			caught = err
		}
		expect(caught).toBeInstanceOf(Error)
		expect(is_unique_constraint_error(caught)).toBe(true)
	})

	it('returns 400 (not 500) when the unique index catches a race the pre-check missed', async () => {
		await make_user(db, 'Taken') // username "taken"
		const racer = await make_user(db, 'Racer')

		// Simulate two requests that both passed the availability check: make only the pre-check
		// (the 2nd select inside update_user_profile) claim the username is free.
		const real_select = db.select.bind(db) as (...args: unknown[]) => unknown
		let select_calls = 0
		const spy = vi.spyOn(db, 'select').mockImplementation(((...args: unknown[]) => {
			select_calls++
			if (select_calls === 2) {
				return { from: () => ({ where: () => ({ get: async () => undefined }) }) }
			}
			return real_select(...args)
		}) as unknown as typeof db.select)
		let status: number
		try {
			status = await status_of(update_user_profile(db, racer, { username: 'taken' }))
		} finally {
			spy.mockRestore()
		}

		expect(select_calls).toBe(2) // the pre-check really was bypassed, so the constraint did the work
		expect(status).toBe(400)
		expect(await username_of(racer)).toBe('racer') // the loser's row is untouched
	})

	it('lets exactly one of two concurrent claims win; the other gets 400', async () => {
		const ann = await make_user(db, 'Ann')
		const ben = await make_user(db, 'Ben')
		const statuses = await Promise.all(
			[ann, ben].map((id) => status_of(update_user_profile(db, id, { username: 'shared_name' }))),
		)
		expect([...statuses].sort()).toEqual([200, 400])
	})
})

describe('update_user_profile: interest validation', () => {
	it('rejects interests that are not an array', async () => {
		const id = await make_user(db, 'NotArray')
		expect(await status_of(update_user_profile(db, id, { interests: 'music' }))).toBe(400)
		expect(await status_of(update_user_profile(db, id, { interests: { a: 1 } }))).toBe(400)
	})

	it('rejects non-string interest entries and invisible characters', async () => {
		const id = await make_user(db, 'BadEntries')
		expect(await status_of(update_user_profile(db, id, { interests: ['ok', 42] }))).toBe(400)
		expect(await status_of(update_user_profile(db, id, { interests: ['zero​width'] }))).toBe(400)
	})

	it('leaves stored interests unchanged when validation fails', async () => {
		const id = await make_user(db, 'KeepsInterests')
		await update_user_profile(db, id, { interests: ['Music'] })
		expect(await status_of(update_user_profile(db, id, { interests: ['x'.repeat(999)] }))).toBe(400)
		const row = await db
			.select({ interests: user.interests })
			.from(user)
			.where(eq(user.id, id))
			.get()
		expect(row?.interests).toBe(JSON.stringify(['Music']))
	})
})

describe('complete_onboarding', () => {
	it('saves interests, bio, and marks onboarded', async () => {
		const id = await make_user(db, 'Newbie')
		const result = await complete_onboarding(db, id, {
			bio: 'Learning new tech',
			interests: ['Technology', 'Design'],
		})
		expect(result.onboarded).toBe(true)
		expect(result.interests).toBe(JSON.stringify(['Technology', 'Design']))
	})

	it('handles skip', async () => {
		const id = await make_user(db, 'Skipper')
		const result = await complete_onboarding(db, id, { skip: true })
		expect(result.onboarded).toBe(true)
	})

	it('does not apply profile changes when the interests are invalid', async () => {
		const id = await make_user(db, 'AtomicOnboard')
		const status = await status_of(
			complete_onboarding(db, id, { name: 'New Name', interests: ['bad\x00value'] }),
		)
		expect(status).toBe(400)
		const row = await db
			.select({ name: user.name, onboarded: user.onboarded })
			.from(user)
			.where(eq(user.id, id))
			.get()
		expect(row?.name).toBe('AtomicOnboard')
		expect(Boolean(row?.onboarded)).toBe(false)
	})

	it('validates interest values during onboarding', async () => {
		const id = await make_user(db, 'OnboardInterest')
		const long_interest = 'x'.repeat(MAX_INTEREST_LENGTH + 1)
		expect(await status_of(complete_onboarding(db, id, { interests: [long_interest] }))).toBe(400)
	})
})

describe('get_suggested_users', () => {
	it('excludes the viewer and users already followed, and indicates follows_you', async () => {
		const viewer = await make_user(db, 'Viewer')
		const u1 = await make_user(db, 'UserOne')
		const u2 = await make_user(db, 'UserTwo')
		const u3 = await make_user(db, 'UserThree')

		// viewer follows u1
		await make_follow(db, viewer, u1)
		// u2 follows viewer
		await make_follow(db, u2, viewer)

		const suggestions = await get_suggested_users(db, viewer, 10)
		const ids = suggestions.map((s) => s.id)

		// Viewer is excluded
		expect(ids).not.toContain(viewer)
		// u1 is already followed by viewer, so excluded from suggestions
		expect(ids).not.toContain(u1)
		// u2 and u3 are suggested
		expect(ids).toContain(u2)
		expect(ids).toContain(u3)

		// u2 follows viewer, so is_followed_by must be true (Follow Back candidate)
		const u2_item = suggestions.find((s) => s.id === u2)
		expect(u2_item?.is_followed_by).toBe(true)
		expect(u2_item?.is_following).toBe(false)
	})
})

describe('get_users_by_interests', () => {
	it('matches users sharing specified interests', async () => {
		const viewer = await make_user(db, 'IntViewer')
		const gamer = await make_user(db, 'Gamer')
		const coder = await make_user(db, 'Coder')

		await update_user_profile(db, gamer, { interests: ['Gaming', 'Music'] })
		await update_user_profile(db, coder, { interests: ['Technology', 'Open Source'] })

		const matched = await get_users_by_interests(db, viewer, ['Gaming'])
		const ids = matched.map((u) => u.id)
		expect(ids).toContain(gamer)
		expect(ids).not.toContain(coder)
	})

	/** Inserts a user with an explicit signup time and raw `interests` column value. */
	async function insert_user(name: string, created_at: Date, interests: string | null) {
		const id = crypto.randomUUID()
		await db.insert(user).values({
			id,
			name,
			email: `${name.toLowerCase()}-${id.slice(0, 6)}@example.com`,
			username: `${name.toLowerCase()}_${id.slice(0, 6)}`,
			interests,
			createdAt: created_at,
			updatedAt: created_at,
		})
		return id
	}

	// Regression: matching used to run over only the 50 newest users, so an older account with
	// a shared interest was silently excluded once enough newer accounts existed.
	it('finds matching users no matter how many newer users exist', async () => {
		const viewer = await make_user(db, 'CapViewer')
		const veteran = await insert_user('Veteran', new Date('2020-01-01'), '["Gardening"]')
		const now = Date.now()
		for (let i = 0; i < 60; i++) {
			await insert_user(`Newcomer${i}`, new Date(now - i * 1000), '["Cooking"]')
		}
		const matched = await get_users_by_interests(db, viewer, ['Gardening'])
		expect(matched.map((u) => u.id)).toEqual([veteran])
	})

	it('matches case-insensitively, ignores blank and duplicate query values', async () => {
		const viewer = await make_user(db, 'CaseViewer')
		const fan = await insert_user('Fan', new Date(), '["Open Source"]')
		const matched = await get_users_by_interests(db, viewer, [
			' open SOURCE ',
			'',
			'  ',
			'OPEN source',
		])
		expect(matched.map((u) => u.id)).toEqual([fan])
	})

	it('matches non-ASCII interests exactly', async () => {
		const viewer = await make_user(db, 'JpViewer')
		const fan = await insert_user('JpFan', new Date(), '["日本語","アニメ"]')
		await insert_user('Other', new Date(), '["料理"]')
		const matched = await get_users_by_interests(db, viewer, ['アニメ'])
		expect(matched.map((u) => u.id)).toEqual([fan])
	})

	it('excludes the viewer and people they already follow', async () => {
		const viewer = await insert_user('SelfMatch', new Date(), '["Hiking"]')
		const followed = await insert_user('Followed', new Date(), '["Hiking"]')
		const stranger = await insert_user('Stranger', new Date(), '["Hiking"]')
		await make_follow(db, viewer, followed)
		const matched = await get_users_by_interests(db, viewer, ['Hiking'])
		expect(matched.map((u) => u.id)).toEqual([stranger])
	})

	it('returns newest accounts first and honours the limit', async () => {
		const viewer = await make_user(db, 'OrderViewer')
		const oldest = await insert_user('Oldest', new Date('2021-01-01'), '["Chess"]')
		const middle = await insert_user('Middle', new Date('2022-01-01'), '["Chess"]')
		const newest = await insert_user('Newest', new Date('2023-01-01'), '["Chess"]')
		expect((await get_users_by_interests(db, viewer, ['Chess'])).map((u) => u.id)).toEqual([
			newest,
			middle,
			oldest,
		])
		expect((await get_users_by_interests(db, viewer, ['Chess'], 2)).map((u) => u.id)).toEqual([
			newest,
			middle,
		])
	})

	it('ignores users whose stored interests are null or malformed instead of failing', async () => {
		const viewer = await make_user(db, 'RobustViewer')
		await insert_user('NoInterests', new Date(), null)
		await insert_user('Garbage', new Date(), 'not json at all')
		const good = await insert_user('Good', new Date(), '["Yoga"]')
		const matched = await get_users_by_interests(db, viewer, ['Yoga'])
		expect(matched.map((u) => u.id)).toEqual([good])
	})

	it('falls back to suggested users when no usable interests are given', async () => {
		const viewer = await make_user(db, 'FallbackViewer')
		const other = await make_user(db, 'FallbackOther')
		const matched = await get_users_by_interests(db, viewer, ['', '   '])
		expect(matched.map((u) => u.id)).toEqual([other])
	})
})

describe('ensure_username', () => {
	it('assigns a username derived from email for users without one', async () => {
		const id = crypto.randomUUID()
		const now = new Date()
		await db.insert(user).values({
			id,
			name: 'NoUsername',
			email: `nousername-${id.slice(0, 6)}@example.com`,
			username: null,
			createdAt: now,
			updatedAt: now,
		})
		const result = await ensure_username(db, id, `nousername-${id.slice(0, 6)}@example.com`)
		expect(result).not.toBe(id) // should not fall back to user_id
		expect(result.length).toBeGreaterThan(0)
	})

	it('returns the existing username if already set', async () => {
		const id = await make_user(db, 'HasUsername')
		const result = await ensure_username(db, id, 'ignored@example.com')
		expect(result).toBe('hasusername')
	})
})

describe('ensure_username: conflicts and errors', () => {
	async function make_user_without_username(email: string) {
		const id = crypto.randomUUID()
		const now = new Date()
		await db
			.insert(user)
			.values({ id, name: 'NoName', email, username: null, createdAt: now, updatedAt: now })
		return id
	}

	it('retries with a numeric suffix when the email-derived username is already taken', async () => {
		await make_user(db, 'Taken') // username "taken" collides with taken@example.com
		const id = await make_user_without_username('taken@example.com')
		const result = await ensure_username(db, id, 'taken@example.com')
		expect(result).toMatch(/^taken\d{4}$/)
		const row = await db.select({ username: user.username }).from(user).where(eq(user.id, id)).get()
		expect(row?.username).toBe(result)
	})

	it('propagates unexpected database errors instead of falling back to the user id', async () => {
		const id = await make_user_without_username('locked@example.com')
		const spy = vi.spyOn(db, 'update').mockImplementation(() => {
			throw new Error('D1_ERROR: database is locked')
		})
		try {
			await expect(ensure_username(db, id, 'locked@example.com')).rejects.toThrow(
				'database is locked',
			)
		} finally {
			spy.mockRestore()
		}
	})
})

describe('discovery limits', () => {
	it('never returns more than the cap, even for a non-numeric or oversized limit', async () => {
		for (let i = 0; i < MAX_SUGGESTION_LIMIT + 20; i++) await make_user(db, `Crowd${i}`)
		// Number('abc') is NaN; drizzle drops LIMIT for NaN, which used to return every user.
		expect(await get_suggested_users(db, null, Number('abc'))).toHaveLength(5)
		expect(await get_suggested_users(db, null, 9999)).toHaveLength(MAX_SUGGESTION_LIMIT)
		expect(await get_suggested_users(db, null, -3)).toHaveLength(1)
		expect(await get_suggested_users(db, null, 0)).toHaveLength(1)
		expect((await get_users_by_interests(db, null, [], Number('abc'))).length).toBeLessThanOrEqual(
			5,
		)
	})
})
