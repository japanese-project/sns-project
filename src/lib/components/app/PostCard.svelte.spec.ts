import { page } from 'vitest/browser'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { api } from '$lib/api'
import type { PostView } from '$lib/types'
import PostCard from './PostCard.svelte'

vi.mock('$app/navigation', () => ({ goto: vi.fn(async () => {}) }))
vi.mock('$lib/api', () => ({ api: vi.fn() }))
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
		const square_rect = container.element().getBoundingClientRect()
		expect(Math.abs(square_rect.width - square_rect.height)).toBeLessThanOrEqual(4)

		// 2. Landscape image (2:1 aspect ratio)
		await rerender({ post: make_post({ image_url: landscape_svg }) })
		await vi.waitFor(() => {
			const ratio = container.element().getAttribute('data-aspect-ratio')
			if (!ratio) throw new Error('aspect ratio not yet calculated')
			expect(Number.parseFloat(ratio)).toBeCloseTo(2.0, 1)
		})
		expect(container.element().style.aspectRatio).toMatch(/^2(\s*\/\s*1)?$/)
		const landscape_rect = container.element().getBoundingClientRect()
		expect(landscape_rect.width).toBeGreaterThan(landscape_rect.height)

		// 3. Portrait image (0.5 aspect ratio)
		await rerender({ post: make_post({ image_url: portrait_svg }) })
		await vi.waitFor(() => {
			const ratio = container.element().getAttribute('data-aspect-ratio')
			if (!ratio) throw new Error('aspect ratio not yet calculated')
			expect(Number.parseFloat(ratio)).toBeCloseTo(0.5, 1)
		})
		expect(container.element().style.aspectRatio).toMatch(/^0\.5(\s*\/\s*1)?$/)
		const portrait_rect = container.element().getBoundingClientRect()
		expect(portrait_rect.height).toBeGreaterThan(portrait_rect.width)
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
})
