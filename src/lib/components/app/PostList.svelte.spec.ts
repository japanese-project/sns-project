import { page } from 'vitest/browser'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { api } from '$lib/api'
import PostList from './PostList.svelte'

vi.mock('$lib/api', () => ({ api: vi.fn() }))

describe('PostList', () => {
	beforeEach(() => {
		vi.mocked(api).mockReset()
	})

	it('shows loading state initially', async () => {
		// Mock api to never resolve so loading stays
		vi.mocked(api).mockImplementation(() => new Promise(() => {}))
		render(PostList, { endpoint: '/api/posts' })

		await expect.element(page.getByLabelText('Loading posts')).toBeInTheDocument()
	})

	it('shows empty state when no posts', async () => {
		vi.mocked(api).mockResolvedValue({ items: [], next_cursor: null })
		render(PostList, { endpoint: '/api/posts', empty_message: 'Custom empty' })

		await vi.waitFor(async () => {
			await expect.element(page.getByText('Custom empty')).toBeVisible()
		})
	})

	it('shows error state with retry button', async () => {
		vi.mocked(api).mockRejectedValue(new Error('Network Error'))
		render(PostList, { endpoint: '/api/posts' })

		await vi.waitFor(async () => {
			await expect.element(page.getByRole('alert')).toHaveTextContent('Network Error')
		})

		const retry_btn = page.getByRole('button', { name: 'Try again' })
		await expect.element(retry_btn).toBeVisible()

		// Clicking retry should fetch again
		vi.mocked(api).mockResolvedValue({ items: [], next_cursor: null })
		await retry_btn.click()

		await vi.waitFor(async () => {
			expect(api).toHaveBeenCalledTimes(2)
			await expect.element(page.getByRole('alert')).not.toBeInTheDocument()
		})
	})

	it('loads the next page when scrolled to the end, without a button', async () => {
		const post = (id: string) => ({
			id,
			content: `post ${id}`,
			visibility: 'public',
			image_url: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			author: { id: 'u1', name: 'Alice', username: 'alice', handle: 'alice', image: null },
			like_count: 0,
			comment_count: 0,
			liked_by_me: false,
			bookmarked_by_me: false,
			repost_count: 0,
			reposted_by_me: false,
			repost_of: null,
			is_owner: false,
		})
		vi.mocked(api)
			.mockResolvedValueOnce({ items: [post('a')], next_cursor: 'c1' })
			.mockResolvedValueOnce({ items: [post('b')], next_cursor: null })
		render(PostList, { endpoint: '/api/posts' })

		await expect.element(page.getByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
		// The sentinel sits right under the one short post, so it is already in view.
		await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(2))
		expect(api).toHaveBeenLastCalledWith('/api/posts?cursor=c1')
		await expect.element(page.getByText("You're all caught up.")).toBeVisible()
	})
})
