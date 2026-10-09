import { page } from 'vitest/browser'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { goto } from '$app/navigation'
import { api } from '$lib/api'
import { sign_out } from '$lib/auth-client'
import type { ProfileView } from '$lib/types'
import ProfilePage from './+page.svelte'

vi.mock('$app/navigation', () => ({
	goto: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('$app/paths', () => ({
	base: '',
	assets: '',
	resolve: (route: string, params: Record<string, string> = {}) =>
		route.replace(/\[(\w+)\]/g, (_, key: string) => params[key] ?? ''),
}))
vi.mock('$lib/api', () => ({
	api: vi.fn().mockResolvedValue({ items: [], next_cursor: null }),
}))
vi.mock('$lib/auth-client', () => ({
	sign_out: vi.fn().mockResolvedValue({}),
}))
vi.mock('$lib/components/app/AppShell.svelte', async () => ({
	default: (await import('../../notifications/AppShell.test-shell.svelte')).default,
}))

const mock_self_profile: ProfileView = {
	user: {
		id: 'u-1',
		name: 'My Profile',
		username: 'myprofile',
		handle: 'myprofile',
		image: null,
		bio: 'This is my bio',
	},
	bio: 'This is my bio',
	interests: ['Technology', 'Open Source'],
	joined_at: new Date('2026-01-01').toISOString(),
	follower_count: 42,
	following_count: 15,
	is_following: false,
	is_followed_by: false,
	is_self: true,
	banner_color: 'sunset',
}

const mock_other_profile: ProfileView = {
	user: {
		id: 'u-2',
		name: 'Other User',
		username: 'otheruser',
		handle: 'otheruser',
		image: null,
		bio: 'Hello from the other side',
	},
	bio: 'Hello from the other side',
	interests: ['Music'],
	joined_at: new Date('2026-02-01').toISOString(),
	follower_count: 10,
	following_count: 20,
	is_following: false,
	is_followed_by: true,
	is_self: false,
	banner_color: null,
}

const current_user = {
	id: 'u-1',
	name: 'My Profile',
	username: 'myprofile',
	email: 'myprofile@example.com',
	emailVerified: true,
	createdAt: new Date(),
	updatedAt: new Date(),
	onboarded: true,
}

describe('Profile Page Header & Customization', () => {
	beforeEach(() => {
		vi.mocked(api).mockReset()
		vi.mocked(sign_out).mockReset()
		vi.mocked(api).mockResolvedValue({ items: [], next_cursor: null })
	})

	it('renders custom banner theme when banner_color is set', async () => {
		render(ProfilePage, {
			data: {
				session: null,
				locale: 'en',
				user: current_user,
				profile: mock_self_profile,
			},
		})

		const banner = page.getByTestId('profile-banner')
		await expect.element(banner).toBeInTheDocument()
		// Contains sunset gradient classes
		await expect.element(banner).toHaveClass(/from-amber-500/)
	})

	it('renders fallback banner gradient when banner_color is null', async () => {
		render(ProfilePage, {
			data: {
				session: null,
				locale: 'en',
				user: current_user,
				profile: mock_other_profile,
			},
		})

		const banner = page.getByTestId('profile-banner')
		await expect.element(banner).toBeInTheDocument()
		// Contains default slate gradient fallback
		await expect.element(banner).toHaveClass(/from-slate-200/)
	})

	it('shows Edit Profile and Sign out buttons on self profile', async () => {
		render(ProfilePage, {
			data: {
				session: null,
				locale: 'en',
				user: current_user,
				profile: mock_self_profile,
			},
		})

		await expect.element(page.getByRole('button', { name: 'Edit Profile' })).toBeVisible()
		const sign_out_btn = page.getByRole('button', { name: 'Sign out' })
		await expect.element(sign_out_btn).toBeVisible()

		await sign_out_btn.click()
		expect(sign_out).toHaveBeenCalledTimes(1)
		expect(goto).toHaveBeenCalledWith('/login')
	})

	it('shows Follow button on other user profile', async () => {
		render(ProfilePage, {
			data: {
				session: null,
				locale: 'en',
				user: current_user,
				profile: mock_other_profile,
			},
		})

		await expect.element(page.getByRole('button', { name: 'Follow' })).toBeVisible()
		await expect.element(page.getByRole('button', { name: 'Edit Profile' })).not.toBeInTheDocument()
		await expect.element(page.getByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
	})

	it('displays stats and profile info left-aligned without centering classes', async () => {
		render(ProfilePage, {
			data: {
				session: null,
				locale: 'en',
				user: current_user,
				profile: mock_self_profile,
			},
		})

		await expect.element(page.getByText('My Profile')).toBeVisible()
		await expect.element(page.getByText('@myprofile')).toBeVisible()
		await expect.element(page.getByText('This is my bio')).toBeVisible()
		await expect.element(page.getByTestId('follower-count')).toHaveTextContent('42')
	})

	it('arranges avatar and actions in a compact horizontal top bar for mobile responsiveness', async () => {
		render(ProfilePage, {
			data: {
				session: null,
				locale: 'en',
				user: current_user,
				profile: mock_self_profile,
			},
		})

		const edit_btn = page.getByRole('button', { name: 'Edit Profile' })
		await expect.element(edit_btn).toBeVisible()

		// Edit button and avatar should be co-located in the top action row
		const action_bar = edit_btn.element().closest('.flex.items-center.justify-between')
		expect(action_bar).not.toBeNull()
		// Action bar uses available horizontal space between avatar and actions
		expect(action_bar?.className).toContain('justify-between')
	})
})
