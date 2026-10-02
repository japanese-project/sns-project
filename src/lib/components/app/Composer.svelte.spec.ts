import { page } from 'vitest/browser'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { api } from '$lib/api'
import Composer from './Composer.svelte'

vi.mock('$lib/api', () => ({ api: vi.fn() }))

const mock_user = { name: 'Test User', image: null }

describe('Composer', () => {
	beforeEach(() => {
		vi.mocked(api).mockReset()
		localStorage.clear()
	})

	it('loads saved draft on mount', async () => {
		localStorage.setItem('composer_draft', 'my saved draft text')
		render(Composer, { user: mock_user })
		await expect
			.element(page.getByPlaceholder('Share your perspective…'))
			.toHaveValue('my saved draft text')
	})

	it('saves draft on input', async () => {
		render(Composer, { user: mock_user })
		const input = page.getByPlaceholder('Share your perspective…')
		await input.fill('new draft')
		await vi.waitFor(() => {
			expect(localStorage.getItem('composer_draft')).toBe('new draft')
		})
	})

	it('discards draft when discard button is clicked', async () => {
		localStorage.setItem('composer_draft', 'some draft')
		render(Composer, { user: mock_user })
		const input = page.getByPlaceholder('Share your perspective…')
		await expect.element(input).toHaveValue('some draft')

		const discard_btn = page.getByRole('button', { name: 'Discard draft' })
		await discard_btn.click()

		await expect.element(input).toHaveValue('')
		await vi.waitFor(() => {
			expect(localStorage.getItem('composer_draft')).toBeNull()
		})
	})

	it('clears draft after successful publish', async () => {
		localStorage.setItem('composer_draft', 'posting this')
		render(Composer, { user: mock_user })
		vi.mocked(api).mockResolvedValue({ id: '123' })

		const publish_btn = page.getByRole('button', { name: 'Publish' })
		await publish_btn.click()

		await vi.waitFor(() => {
			expect(localStorage.getItem('composer_draft')).toBeNull()
		})
	})

	it('previews selected image and allows removing before publish', async () => {
		render(Composer, { user: mock_user })

		// Initial state: no image preview
		await expect
			.element(page.getByRole('img', { name: 'Selected preview' }))
			.not.toBeInTheDocument()

		// Select a file
		const file = new File(['fake content'], 'test.png', { type: 'image/png' })
		const file_input = document.querySelector('input[type="file"]') as HTMLInputElement
		expect(file_input).toBeTruthy()

		Object.defineProperty(file_input, 'files', {
			value: [file],
			writable: true,
		})
		file_input.dispatchEvent(new Event('change', { bubbles: true }))

		const preview = page.getByRole('img', { name: 'Selected preview' })
		await expect.element(preview).toBeInTheDocument()

		const remove_btn = page.getByRole('button', { name: 'Remove image' })
		await expect.element(remove_btn).toBeVisible()

		await remove_btn.click()
		await expect.element(preview).not.toBeInTheDocument()
	})
})
