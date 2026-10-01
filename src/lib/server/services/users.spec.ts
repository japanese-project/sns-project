import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
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
import { MAX_INTEREST_LENGTH } from '$lib/limits'

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
