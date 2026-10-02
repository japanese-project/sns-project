import { page } from 'vitest/browser'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { api } from '$lib/api'
import type { NotificationView } from '$lib/types'
import type { PageProps } from './$types'
import Notifications from './+page.svelte'

vi.mock('$lib/api', () => ({ api: vi.fn() }))
vi.mock('$app/paths', () => ({
	resolve: (route: string, params: Record<string, string> = {}) =>
		route.replace(/\[(\w+)\]/g, (_, key: string) => params[key]),
}))
vi.mock('$lib/components/app/AppShell.svelte', async () => ({
	default: (await import('./AppShell.test-shell.svelte')).default,
}))

const note: NotificationView = {
	id: 'n1',
	type: 'like',
	read: false,
	created_at: new Date().toISOString(),
	actor: { id: 'u2', name: 'Sam', username: 'sam', handle: 'sam', image: null },
	post_id: 'p1',
	snippet: 'hello world',
}

// A real click on the <a> would navigate the test frame away; cancel the default action after
// the component's own handler has run (it runs at the target, before the event bubbles here).
const cancel_navigation = (event: Event) => event.preventDefault()

describe('notifications page', () => {
	beforeEach(() => {
		document.addEventListener('click', cancel_navigation)
		vi.mocked(api).mockReset()
		vi.mocked(api).mockImplementation((async (path: string) =>
			path.startsWith('/api/notifications/read')
				? { unread_count: 0 }
				: { items: [note], next_cursor: null, unread_count: 1 }) as typeof api)
	})
	afterEach(() => document.removeEventListener('click', cancel_navigation))

	// Regression: the read request was fire-and-forget on a link click. On a full-page navigation
	// the browser drops the connection, so the server could be cut off before marking it read.
	it('sends the read request with keepalive so it survives navigation', async () => {
		render(Notifications, { data: { user: { id: 'u1' } } as unknown as PageProps['data'] })

		const link = page.getByRole('link', { name: /Sam liked your post/ })
		await expect.element(link).toHaveAttribute('data-unread', 'true')
		await link.click()

		await vi.waitFor(() =>
			expect(api).toHaveBeenCalledWith('/api/notifications/read', {
				method: 'POST',
				body: { id: 'n1' },
				keepalive: true,
			}),
		)
		await expect.element(link).toHaveAttribute('data-unread', 'false')
	})

	it('does not send a read request for a notification that is already read', async () => {
		vi.mocked(api).mockImplementation((async () => ({
			items: [{ ...note, read: true }],
			next_cursor: null,
			unread_count: 0,
		})) as typeof api)
		render(Notifications, { data: { user: { id: 'u1' } } as unknown as PageProps['data'] })

		await page.getByRole('link', { name: /Sam liked your post/ }).click()
		expect(api).toHaveBeenCalledTimes(1) // only the initial list load
	})
})
