import { page } from 'vitest/browser'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { api } from '$lib/api'
import { sign_out } from '$lib/auth-client'
import AppShellHost from './AppShell.test-host.svelte'

vi.mock('$app/navigation', () => ({
	goto: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./OnboardingModal.svelte', () => ({
	default: () => null,
}))
vi.mock('./Composer.svelte', () => ({
	default: () => null,
}))
vi.mock('$app/paths', () => ({
	base: '',
	assets: '',
	resolve: (route: string, params: Record<string, string> = {}) =>
		route.replace(/\[(\w+)\]/g, (_, key: string) => params[key] ?? ''),
}))
vi.mock('$lib/api', () => ({
	api: vi.fn().mockResolvedValue({ unread_count: 0 }),
}))
vi.mock('$lib/auth-client', () => ({
	sign_out: vi.fn().mockResolvedValue({}),
}))

const mock_user = {
	id: 'user-1',
	name: 'Test User',
	username: 'testuser',
	onboarded: true,
}

describe('AppShell', () => {
	beforeEach(() => {
		vi.mocked(api).mockClear()
		vi.mocked(sign_out).mockClear()
	})

	it('uses consistent content width max-w-2xl and centered alignment', async () => {
		render(AppShellHost, { user: mock_user })

		const main = page.getByRole('main')
		await expect.element(main).toBeInTheDocument()

		// Center container must enforce consistent max-w-2xl width across all page types
		const container = main.element().querySelector('.max-w-2xl')
		expect(container).not.toBeNull()
		expect(container?.className).toContain('w-full')
		expect(container?.className).toContain('max-w-2xl')
	})
})
