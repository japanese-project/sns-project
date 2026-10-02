import { describe, expect, it } from 'vitest'
import { is_admin_user } from './admin'

describe('Admin authorization logic', () => {
	it('identifies owner by email and username', () => {
		expect(
			is_admin_user({
				id: 'any-id',
				email: 'sreng087@gmail.com',
				username: 'sreng087',
			}),
		).toBe(true)

		expect(
			is_admin_user({
				id: 'any-id',
				email: 'other@example.com',
				username: 'sreng087',
			}),
		).toBe(true)

		expect(
			is_admin_user({
				id: 'any-id',
				email: 'sreng087@gmail.com',
				username: 'someone_else',
			}),
		).toBe(true)
	})

	it('identifies admin configured via environment variables', () => {
		const env = {
			ADMIN_EMAILS: 'custom_admin@example.com, boss@company.org',
			ADMIN_USERNAMES: 'super_admin, operations',
			ADMIN_USER_IDS: 'usr_special_123',
		}

		expect(
			is_admin_user({ id: 'usr_1', email: 'custom_admin@example.com', username: 'random' }, env),
		).toBe(true)

		expect(
			is_admin_user({ id: 'usr_2', email: 'random@example.com', username: 'super_admin' }, env),
		).toBe(true)

		expect(
			is_admin_user(
				{ id: 'usr_special_123', email: 'random@example.com', username: 'random' },
				env,
			),
		).toBe(true)
	})

	it('authorizes with secret override', () => {
		const env = {
			BOT_CRON_SECRET: 'super-secret-key-12345',
		}

		expect(
			is_admin_user(
				{ id: 'random_id', email: 'random@example.com', username: 'random' },
				env,
				'super-secret-key-12345',
			),
		).toBe(true)

		expect(
			is_admin_user(
				{ id: 'random_id', email: 'random@example.com', username: 'random' },
				env,
				'wrong-secret',
			),
		).toBe(false)
	})

	it('denies unauthenticated or regular users with no admin config', () => {
		const env = {
			ADMIN_EMAILS: 'only_this_one@example.com',
		}

		expect(is_admin_user(null, env)).toBe(false)
		expect(
			is_admin_user(
				{ id: 'regular_user', email: 'regular@example.com', username: 'regular_dude' },
				env,
			),
		).toBe(false)
	})
})
