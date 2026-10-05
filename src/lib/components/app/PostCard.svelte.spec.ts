import { page } from 'vitest/browser'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { api } from '$lib/api'
import type { PostView } from '$lib/types'
import PostCard from './PostCard.svelte'

vi.mock('$app/navigation', () => ({ goto: vi.fn(async () => {}) }))
vi.mock('$lib/api', () => ({ api: vi.fn() }))
vi.mock('$lib/link-preview-client', async (import_original) => {
	const actual = await import_original<typeof import('$lib/link-preview-client')>()
	return {
		...actual,
		get_link_preview: vi.fn(async () => null),
	}
})
vi.mock('$app/paths', () => ({
	base: '',
	assets: '',
	resolve: (route: string, params: Record<string, string> = {}) =>
		route.replace(/\[(\w+)\]/g, (_, key: string) => params[key] ?? ''),
}))

function make_post(overrides: Partial<PostView> = {}): PostView {
	return {
		id: 'p1',
		content: 'Hello world',
		visibility: 'public',
		image_url: null,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		author: {
			id: 'u1',
			name: 'Alice',
			username: 'alice',
			handle: 'alice',
			image: null,
		},
		like_count: 0,
		comment_count: 0,
		liked_by_me: false,
		bookmarked_by_me: false,
		repost_count: 0,
		reposted_by_me: false,
		repost_of: null,
		is_owner: false,
		...overrides,
	}
}

describe('PostCard media rendering', () => {
	beforeEach(() => {
		vi.mocked(api).mockReset()
	})

	it('renders image when post has image_url', async () => {
		const post = make_post({ image_url: '/api/media/test-photo.jpg' })
		render(PostCard, { post })

		const image = page.getByRole('img', { name: 'Post attachment' })
		await expect.element(image).toBeInTheDocument()
		await expect.element(image).toHaveAttribute('src', '/api/media/test-photo.jpg')
	})

	it('does not render attachment image when post has no image_url', async () => {
		const post = make_post({ image_url: null })
		render(PostCard, { post })

		const image = page.getByRole('img', { name: 'Post attachment' })
		await expect.element(image).not.toBeInTheDocument()
	})

	it('renders image-only post with empty content', async () => {
		const post = make_post({ content: '', image_url: '/api/media/image-only.png' })
		render(PostCard, { post })

		const image = page.getByRole('img', { name: 'Post attachment' })
		await expect.element(image).toBeInTheDocument()
		await expect.element(image).toHaveAttribute('src', '/api/media/image-only.png')
	})

	it('renders image within stable aspect-ratio container with object-contain', async () => {
		const post = make_post({ image_url: '/api/media/test-photo.jpg' })
		render(PostCard, { post })

		const image = page.getByRole('img', { name: 'Post attachment' })
		await expect.element(image).toBeInTheDocument()
		await expect.element(image).toHaveClass(/object-contain/)
	})

	it('renders fallback when attachment image fails to load with 404 response', async () => {
		const post = make_post({ image_url: '/api/media/non-existent-404.jpg' })
		render(PostCard, { post })

		const image = page.getByRole('img', { name: 'Post attachment' })
		await expect.element(image).toBeInTheDocument()

		const img_el = image.element()
		img_el.dispatchEvent(new Event('error'))

		await expect.element(page.getByTestId('broken-image-fallback')).toBeInTheDocument()
		await expect.element(page.getByText('Media unavailable')).toBeInTheDocument()
	})

	it('renders fallback when attachment image fails decoding (corrupted data)', async () => {
		const post = make_post({ image_url: 'data:image/png;base64,invalid-corrupted-stream' })
		render(PostCard, { post })

		await expect.element(page.getByTestId('broken-image-fallback')).toBeInTheDocument()
		await expect.element(page.getByText('Media unavailable')).toBeInTheDocument()
	})

	it('resets broken-image failure state when post image_url changes', async () => {
		const initial_post = make_post({ image_url: '/api/media/initial-404.jpg' })
		const { rerender } = render(PostCard, { post: initial_post })

		const image = page.getByRole('img', { name: 'Post attachment' })
		image.element().dispatchEvent(new Event('error'))

		await expect.element(page.getByTestId('broken-image-fallback')).toBeInTheDocument()

		// Update post with a valid image URL
		const updated_post = { ...initial_post, image_url: '/api/media/valid-photo.jpg' }
		await rerender({ post: updated_post })

		await expect.element(page.getByTestId('broken-image-fallback')).not.toBeInTheDocument()
		const new_img = page.getByRole('img', { name: 'Post attachment' })
		await expect.element(new_img).toBeInTheDocument()
		await expect.element(new_img).toHaveAttribute('src', '/api/media/valid-photo.jpg')
	})

	it('preserves natural aspect ratio for square, landscape, and portrait images', async () => {
		const square_svg =
			'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="blue"/></svg>'
		const landscape_svg =
			'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="green"/></svg>'
		const portrait_svg =
			'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="800"><rect width="400" height="800" fill="purple"/></svg>'

		// 1. Square image (1:1 aspect ratio)
		const { rerender } = render(PostCard, { post: make_post({ image_url: square_svg }) })
		const container = page.getByTestId('post-image-container')
		await expect.element(container).toBeInTheDocument()

		// Wait for load/aspect ratio calculation
		await vi.waitFor(() => {
			const ratio = container.element().getAttribute('data-aspect-ratio')
			if (!ratio) throw new Error('aspect ratio not yet calculated')
			expect(Number.parseFloat(ratio)).toBeCloseTo(1.0, 1)
		})
		expect(container.element().style.aspectRatio).toMatch(/^1(\s*\/\s*1)?$/)
		await vi.waitFor(() => {
			const square_rect = container.element().getBoundingClientRect()
			if (Math.abs(square_rect.width - square_rect.height) > 4) {
				throw new Error(
					`Square dimensions not yet stabilized: ${square_rect.width}x${square_rect.height}`,
				)
			}
		})

		// 2. Landscape image (2:1 aspect ratio)
		await rerender({ post: make_post({ image_url: landscape_svg }) })
		await vi.waitFor(() => {
			const ratio = container.element().getAttribute('data-aspect-ratio')
			if (!ratio) throw new Error('aspect ratio not yet calculated')
			expect(Number.parseFloat(ratio)).toBeCloseTo(2.0, 1)
		})
		expect(container.element().style.aspectRatio).toMatch(/^2(\s*\/\s*1)?$/)
		await vi.waitFor(() => {
			const landscape_rect = container.element().getBoundingClientRect()
			if (landscape_rect.width <= landscape_rect.height) {
				throw new Error('Landscape dimensions not yet stabilized')
			}
		})

		// 3. Portrait image (0.5 aspect ratio)
		await rerender({ post: make_post({ image_url: portrait_svg }) })
		await vi.waitFor(() => {
			const ratio = container.element().getAttribute('data-aspect-ratio')
			if (!ratio) throw new Error('aspect ratio not yet calculated')
			expect(Number.parseFloat(ratio)).toBeCloseTo(0.5, 1)
		})
		expect(container.element().style.aspectRatio).toMatch(/^0\.5(\s*\/\s*1)?$/)
		await vi.waitFor(() => {
			const portrait_rect = container.element().getBoundingClientRect()
			if (portrait_rect.height <= portrait_rect.width) {
				throw new Error('Portrait dimensions not yet stabilized')
			}
		})
	})

	it('reserves final aspect ratio immediately when dimension hints are provided in url', async () => {
		// Provide an image URL with dimension hints (e.g. ?w=1600&h=900)
		const post = make_post({ image_url: '/api/media/photo.jpg?w=1600&h=900' })
		render(PostCard, { post })

		const container = page.getByTestId('post-image-container')
		await expect.element(container).toBeInTheDocument()

		// The container immediately reserves the 16:9 (1.78) ratio before the network request finishes
		const ratio = container.element().getAttribute('data-aspect-ratio')
		expect(ratio).not.toBeNull()
		expect(Number.parseFloat(ratio!)).toBeCloseTo(1600 / 900, 1)
	})
})

describe('PostCard action menu', () => {
	beforeEach(() => {
		vi.mocked(api).mockReset()
	})

	it('renders ellipsis button and opens dropdown menu on click', async () => {
		const post = make_post({ is_owner: true })
		render(PostCard, { post })

		const menu_btn = page.getByRole('button', { name: 'More options' })
		await expect.element(menu_btn).toBeVisible()

		// Menu items not visible initially
		await expect.element(page.getByRole('menuitem', { name: 'Edit post' })).not.toBeInTheDocument()

		// Clicking menu button opens dropdown
		await menu_btn.click()

		await expect.element(page.getByRole('menuitem', { name: 'Copy link' })).toBeVisible()
		await expect.element(page.getByRole('menuitem', { name: 'Edit post' })).toBeVisible()
		await expect.element(page.getByRole('menuitem', { name: 'Delete post' })).toBeVisible()
	})

	it('non-owner sees copy link but not edit or delete options', async () => {
		const post = make_post({ is_owner: false })
		render(PostCard, { post })

		const menu_btn = page.getByRole('button', { name: 'More options' })
		await menu_btn.click()

		await expect.element(page.getByRole('menuitem', { name: 'Copy link' })).toBeVisible()
		await expect.element(page.getByRole('menuitem', { name: 'Edit post' })).not.toBeInTheDocument()
		await expect
			.element(page.getByRole('menuitem', { name: 'Delete post' }))
			.not.toBeInTheDocument()
	})

	it('opens edit mode when edit post is clicked', async () => {
		const post = make_post({ is_owner: true })
		render(PostCard, { post })

		const menu_btn = page.getByRole('button', { name: 'More options' })
		await menu_btn.click()

		const edit_item = page.getByRole('menuitem', { name: 'Edit post' })
		await edit_item.click()

		// Composer edit mode should now be displayed
		await expect.element(page.getByLabelText('Edit post text')).toBeVisible()
		await expect.element(page.getByRole('button', { name: 'Save changes' })).toBeVisible()
	})

	it('opens delete confirmation dialog when delete post is clicked', async () => {
		const post = make_post({ is_owner: true })
		render(PostCard, { post })

		const menu_btn = page.getByRole('button', { name: 'More options' })
		await menu_btn.click()

		const delete_item = page.getByRole('menuitem', { name: 'Delete post' })
		await delete_item.click()

		// Alert dialog for delete confirmation should be visible
		await expect.element(page.getByRole('alertdialog')).toBeVisible()
		await expect.element(page.getByText('Delete this post and its comments?')).toBeVisible()
	})

	it('copies link when Copy link is clicked', async () => {
		const write_text = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
		const post = make_post({ id: 'p123' })
		render(PostCard, { post })

		const menu_btn = page.getByRole('button', { name: 'More options' })
		await menu_btn.click()

		const copy_btn = page.getByRole('menuitem', { name: 'Copy link' })
		await copy_btn.click()

		expect(write_text).toHaveBeenCalledWith(expect.stringContaining('/posts/p123'))
		await expect.element(page.getByText('Copied!')).toBeVisible()
	})

	it('shows error feedback when clipboard copy fails or throws', async () => {
		vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Permission denied'))
		const post = make_post({ id: 'p123' })
		render(PostCard, { post })

		const menu_btn = page.getByRole('button', { name: 'More options' })
		await menu_btn.click()

		const copy_btn = page.getByRole('menuitem', { name: 'Copy link' })
		await copy_btn.click()

		await expect.element(page.getByText('Failed to copy')).toBeVisible()
		await expect.element(page.getByText('Copied!')).not.toBeInTheDocument()
	})

	it('shows error feedback when clipboard API is unavailable', async () => {
		const original_clipboard = navigator.clipboard
		// @ts-expect-error simulating missing clipboard
		delete window.navigator.clipboard

		try {
			const post = make_post({ id: 'p123' })
			render(PostCard, { post })

			const menu_btn = page.getByRole('button', { name: 'More options' })
			await menu_btn.click()

			const copy_btn = page.getByRole('menuitem', { name: 'Copy link' })
			await copy_btn.click()

			await expect.element(page.getByText('Failed to copy')).toBeVisible()
			await expect.element(page.getByText('Copied!')).not.toBeInTheDocument()
		} finally {
			Object.defineProperty(navigator, 'clipboard', {
				value: original_clipboard,
				configurable: true,
			})
		}
	})

	it('supports keyboard navigation through menu items and closes on Escape with restored focus', async () => {
		const post = make_post({ is_owner: true })
		render(PostCard, { post })

		const menu_btn = page.getByRole('button', { name: 'More options' })
		menu_btn.element().focus()

		// ArrowDown on trigger button opens menu and focuses first item
		menu_btn
			.element()
			.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
		await expect.element(page.getByRole('menuitem', { name: 'Copy link' })).toBeVisible()

		const menu = page.getByRole('menu', { name: 'Post actions' }).element()
		const copy_item = page.getByRole('menuitem', { name: 'Copy link' }).element()
		const edit_item = page.getByRole('menuitem', { name: 'Edit post' }).element()
		const delete_item = page.getByRole('menuitem', { name: 'Delete post' }).element()

		copy_item.focus()
		expect(document.activeElement).toBe(copy_item)

		// ArrowDown in menu moves focus to next item
		menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
		expect(document.activeElement).toBe(edit_item)

		// ArrowDown again moves to delete item
		menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
		expect(document.activeElement).toBe(delete_item)

		// ArrowUp moves back to edit item
		menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
		expect(document.activeElement).toBe(edit_item)

		// Escape closes menu and returns focus to menu button
		menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
		await expect.element(page.getByRole('menuitem', { name: 'Copy link' })).not.toBeInTheDocument()
		expect(document.activeElement).toBe(menu_btn.element())
	})

	it('closes menu on Escape key press', async () => {
		const post = make_post({ is_owner: true })
		render(PostCard, { post })

		const menu_btn = page.getByRole('button', { name: 'More options' })
		await menu_btn.click()
		await expect.element(page.getByRole('menuitem', { name: 'Copy link' })).toBeVisible()

		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

		await expect.element(page.getByRole('menuitem', { name: 'Copy link' })).not.toBeInTheDocument()
	})

	it('closes menu on outside click', async () => {
		const post = make_post({ is_owner: true })
		render(PostCard, { post })

		const menu_btn = page.getByRole('button', { name: 'More options' })
		await menu_btn.click()
		await expect.element(page.getByRole('menuitem', { name: 'Copy link' })).toBeVisible()

		document.body.click()

		await expect.element(page.getByRole('menuitem', { name: 'Copy link' })).not.toBeInTheDocument()
	})

	it('renders URLs in post content as clickable external links', async () => {
		const post = make_post({
			content: 'Read more at https://example.com/article and #tech',
		})
		render(PostCard, { post })

		const link = page.getByRole('link', { name: 'https://example.com/article' })
		await expect.element(link).toBeInTheDocument()
		await expect.element(link).toHaveAttribute('href', 'https://example.com/article')
		await expect.element(link).toHaveAttribute('target', '_blank')
		await expect.element(link).toHaveAttribute('rel', 'noopener noreferrer')

		const tag = page.getByRole('link', { name: '#tech' })
		await expect.element(tag).toBeInTheDocument()
	})
})

describe('PostCard favorites and reposts', () => {
	beforeEach(() => {
		vi.mocked(api).mockReset()
	})

	it('adds and removes a post from favorites', async () => {
		vi.mocked(api)
			.mockResolvedValueOnce({ bookmarked: true })
			.mockResolvedValueOnce({ bookmarked: false })
		render(PostCard, { post: make_post({ id: 'p9' }) })

		const save = page.getByTestId('bookmark-button')
		await expect.element(save).toHaveAttribute('aria-pressed', 'false')
		await save.click()
		await expect.element(save).toHaveAttribute('aria-pressed', 'true')
		expect(api).toHaveBeenLastCalledWith('/api/posts/p9/bookmark', { method: 'PUT' })

		await save.click()
		await expect.element(save).toHaveAttribute('aria-pressed', 'false')
		expect(api).toHaveBeenLastCalledWith('/api/posts/p9/bookmark', { method: 'DELETE' })
	})

	it('rolls the favorite back and shows an error when saving fails', async () => {
		vi.mocked(api).mockRejectedValueOnce(new Error('Post not found'))
		render(PostCard, { post: make_post() })

		const save = page.getByTestId('bookmark-button')
		await save.click()
		await expect.element(page.getByText('Post not found')).toBeVisible()
		await expect.element(save).toHaveAttribute('aria-pressed', 'false')
	})

	it('reposts instantly from the menu and undoes it, updating the count', async () => {
		vi.mocked(api)
			.mockResolvedValueOnce({ reposted: true, repost_count: 3 })
			.mockResolvedValueOnce({ reposted: false, repost_count: 2 })
		render(PostCard, { post: make_post({ id: 'p7', repost_count: 2 }) })

		const repost = page.getByTestId('repost-button')
		await repost.click()
		await page.getByRole('menuitem', { name: 'Repost', exact: true }).click()
		await expect.element(repost).toHaveAttribute('aria-pressed', 'true')
		await expect.element(page.getByTestId('repost-count')).toHaveTextContent('3')
		expect(api).toHaveBeenLastCalledWith('/api/posts/p7/repost', {
			method: 'PUT',
			body: undefined,
		})

		await repost.click()
		await page.getByRole('menuitem', { name: 'Undo repost' }).click()
		await expect.element(repost).toHaveAttribute('aria-pressed', 'false')
		await expect.element(page.getByTestId('repost-count')).toHaveTextContent('2')
		expect(api).toHaveBeenLastCalledWith('/api/posts/p7/repost', { method: 'DELETE' })
	})

	it('reposts with a caption', async () => {
		vi.mocked(api).mockResolvedValueOnce({ reposted: true, repost_count: 1 })
		render(PostCard, { post: make_post({ id: 'p8' }) })

		await page.getByTestId('repost-button').click()
		await page.getByRole('menuitem', { name: 'Repost with caption' }).click()
		await page.getByLabelText('Repost caption').fill('This is so true')
		await page.getByRole('button', { name: 'Repost', exact: true }).first().click()

		expect(api).toHaveBeenLastCalledWith('/api/posts/p8/repost', {
			method: 'PUT',
			body: { content: 'This is so true' },
		})
		await expect.element(page.getByLabelText('Repost caption')).not.toBeInTheDocument()
		await expect.element(page.getByTestId('repost-button')).toHaveAttribute('aria-pressed', 'true')
	})

	it('prefills and saves a new caption on your own repost', async () => {
		vi.mocked(api).mockResolvedValueOnce({ reposted: true, repost_count: 1 })
		const original = make_post({ id: 'orig', reposted_by_me: true, repost_count: 1 })
		const repost = make_post({
			id: 'r1',
			content: 'old caption',
			is_owner: true,
			repost_of: original,
		})
		const on_updated = vi.fn()
		render(PostCard, { post: repost, on_updated })

		await page.getByTestId('repost-button').click()
		await page.getByRole('menuitem', { name: 'Edit caption' }).click()
		const box = page.getByLabelText('Repost caption')
		await expect.element(box).toHaveValue('old caption')
		await box.fill('new caption')
		await page.getByRole('button', { name: 'Save caption' }).click()

		expect(api).toHaveBeenLastCalledWith('/api/posts/orig/repost', {
			method: 'PUT',
			body: { content: 'new caption' },
		})
		await vi.waitFor(() =>
			expect(on_updated).toHaveBeenCalledWith(
				expect.objectContaining({ id: 'r1', content: 'new caption' }),
			),
		)
	})

	it('rolls the repost back and shows an error when it fails', async () => {
		vi.mocked(api).mockRejectedValueOnce(new Error('Only public posts can be reposted'))
		render(PostCard, { post: make_post({ repost_count: 1 }) })

		await page.getByTestId('repost-button').click()
		await page.getByRole('menuitem', { name: 'Repost', exact: true }).click()
		await expect.element(page.getByText('Only public posts can be reposted')).toBeVisible()
		await expect.element(page.getByTestId('repost-button')).toHaveAttribute('aria-pressed', 'false')
		await expect.element(page.getByTestId('repost-count')).toHaveTextContent('1')
	})

	it('disables reposting a followers-only post', async () => {
		render(PostCard, { post: make_post({ visibility: 'followers-only' }) })
		await expect.element(page.getByTestId('repost-button')).toBeDisabled()
	})

	it('shows who reposted above the original post', async () => {
		const original = make_post({ id: 'orig', content: 'The original words' })
		const repost = make_post({
			id: 'r1',
			content: '',
			author: { id: 'u2', name: 'Bob', username: 'bob', handle: 'bob', image: null },
			repost_of: original,
		})
		render(PostCard, { post: { ...repost, content: 'Bob says hi' } })

		await expect.element(page.getByTestId('repost-caption')).toHaveTextContent('Bob says hi')
		await expect.element(page.getByTestId('repost')).toHaveTextContent('Bob')
		await expect.element(page.getByTestId('repost')).toHaveTextContent('reposted')
		await expect.element(page.getByText('The original words')).toBeVisible()
		await expect
			.element(page.getByRole('link', { name: /Bob/ }).first())
			.toHaveAttribute('href', '/u/bob')
	})

	it('acts on the original post and drops your own repost item when you undo it', async () => {
		vi.mocked(api).mockResolvedValueOnce({ reposted: false, repost_count: 0 })
		const on_deleted = vi.fn()
		const original = make_post({ id: 'orig', reposted_by_me: true, repost_count: 1 })
		const repost = make_post({ id: 'r1', content: '', is_owner: true, repost_of: original })
		render(PostCard, { post: repost, on_deleted })

		await expect.element(page.getByTestId('repost')).toHaveTextContent('You')
		await page.getByTestId('repost-button').click()
		await page.getByRole('menuitem', { name: 'Undo repost' }).click()
		expect(api).toHaveBeenLastCalledWith('/api/posts/orig/repost', { method: 'DELETE' })
		await vi.waitFor(() => expect(on_deleted).toHaveBeenCalledWith('r1'))
	})
})
