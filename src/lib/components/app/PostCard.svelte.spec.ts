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

	it('renders fallback when attachment image fails to load', async () => {
		const post = make_post({ image_url: '/api/media/non-existent.jpg' })
		render(PostCard, { post })

		const image = page.getByRole('img', { name: 'Post attachment' })
		await expect.element(image).toBeInTheDocument()

		const img_el = image.element()
		img_el.dispatchEvent(new Event('error'))

		await expect.element(page.getByTestId('broken-image-fallback')).toBeInTheDocument()
		await expect.element(page.getByText('Media unavailable')).toBeInTheDocument()
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
