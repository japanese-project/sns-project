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

		// Clicking the trigger only opens the confirmation dialog — nothing signs out yet
		await sign_out_btn.click()
		expect(sign_out).not.toHaveBeenCalled()
		expect(goto).not.toHaveBeenCalled()

		// Cancelling the dialog dismisses it without signing out
		const cancel_btn = page.getByRole('button', { name: 'Cancel' })
		await expect.element(cancel_btn).toBeVisible()
		await cancel_btn.click()
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
		expect(sign_out).not.toHaveBeenCalled()

		// Confirming signs out and navigates to the login page
		await sign_out_btn.click()
		const dialog = page.getByRole('dialog', { name: 'Sign out?' })
		await expect.element(dialog).toBeVisible()
		await dialog.getByRole('button', { name: 'Sign out' }).click()
		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument()
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

	it('overlaps only the avatar with the banner and keeps actions on the page background', async () => {
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

		// The avatar wrapper is the first item of the header action row
		const actions = edit_btn.element().closest('.flex.items-center.justify-between')
		const row = actions?.parentElement
		const avatar = row?.firstElementChild
		expect(avatar).toBeDefined()

		// Only the avatar hangs over the banner; the row itself is not pulled up
		expect(avatar?.className).toMatch(/-mt-(12|14)/)
		expect(row?.className).not.toMatch(/-mt-/)

		// Actions are bottom-aligned against the avatar instead of straddling the banner border
		expect(row?.className).toContain('items-end')
		expect(row?.className).toMatch(/\bpt-\d/)
		expect(actions?.className).not.toMatch(/\b-?mt-\d/)
	})

	it('exposes a single banner theme trigger anchored inside the banner', async () => {
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

		// The only remaining trigger is the "Change cover" button pinned to the banner
		const cover_btn = page.getByRole('button', { name: 'Change cover' })
		await expect.element(cover_btn).toBeVisible()
		expect(page.getByRole('button', { name: /change cover/i }).elements()).toHaveLength(1)
		expect(page.getByRole('button', { name: /change banner/i }).elements()).toHaveLength(0)
		expect(banner.element().parentElement?.contains(cover_btn.element())).toBe(true)
		expect(cover_btn.element().className).toContain('absolute')

		// The action row keeps only Edit Profile and Sign out next to the settings link
		const actions = page
			.getByRole('button', { name: 'Edit Profile' })
			.element()
			.closest('.flex.items-center.justify-between')
		const action_buttons = Array.from(actions?.querySelectorAll('button') ?? []).map(
			(button) => button.getAttribute('aria-label') ?? button.textContent?.trim(),
		)
		expect(action_buttons).toEqual(['Edit Profile', 'Sign out'])
		expect(actions?.contains(page.getByRole('link', { name: 'Settings' }).element())).toBe(true)
	})
})
