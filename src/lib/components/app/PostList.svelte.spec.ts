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
		
		await expect.element(page.getByLabelText('Loading posts')).toBeVisible()
	})

	it('shows empty state when no posts', async () => {
		vi.mocked(api).mockResolvedValue({ items: [], next_cursor: null })
		render(PostList, { endpoint: '/api/posts', empty_message: 'Custom empty' })
		
		await vi.waitFor(() => {
			expect.element(page.getByText('Custom empty')).toBeVisible()
		})
	})

	it('shows error state with retry button', async () => {
		vi.mocked(api).mockRejectedValue(new Error('Network Error'))
		render(PostList, { endpoint: '/api/posts' })
		
		await vi.waitFor(() => {
			expect.element(page.getByRole('alert')).toHaveTextContent('Network Error')
		})
		
		const retry_btn = page.getByRole('button', { name: 'Try again' })
		await expect.element(retry_btn).toBeVisible()

		// Clicking retry should fetch again
		vi.mocked(api).mockResolvedValue({ items: [], next_cursor: null })
		await retry_btn.click()
		
		await vi.waitFor(() => {
			expect(api).toHaveBeenCalledTimes(2)
			expect.element(page.getByRole('alert')).not.toBeInTheDocument()
		})
	})
})
