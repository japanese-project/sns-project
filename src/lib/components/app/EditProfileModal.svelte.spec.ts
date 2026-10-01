import { page } from 'vitest/browser'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { goto } from '$app/navigation'
import { api } from '$lib/api'
import EditProfileModal from './EditProfileModal.test-host.svelte'

vi.mock('$app/navigation', () => ({ goto: vi.fn(async () => {}) }))
vi.mock('$app/paths', () => ({
	resolve: (route: string, params: Record<string, string>) =>
		route.replace(/\[(\w+)\]/g, (_, key: string) => params[key]),
}))
vi.mock('$lib/api', () => ({ api: vi.fn() }))

function saved_user(username: string) {
	return {
		id: 'user-1',
		name: 'Old Name',
		username,
		handle: username,
		image: null,
		bio: null,
		interests: '[]',
	}
}

async function save_with_username(username: string) {
	render(EditProfileModal)
	await page.getByLabelText('Username').fill(username)
	await page.getByRole('button', { name: 'Save' }).click()
}

describe('EditProfileModal: username change', () => {
	beforeEach(() => {
		vi.mocked(goto).mockClear()
		vi.mocked(api).mockReset()
	})

	// Regression: the modal compared the new handle with `user.handle` AFTER the parent had
	// already updated its state, so the two were always equal and the browser stayed on the dead
	// /u/oldname URL while the page showed (and linked to) the new handle.
	it('navigates to the new canonical profile URL, replacing the dead one in history', async () => {
		vi.mocked(api).mockResolvedValue(saved_user('newname'))
		await save_with_username('newname')

		await vi.waitFor(() => expect(goto).toHaveBeenCalledTimes(1))
		expect(goto).toHaveBeenCalledWith('/u/newname', { replaceState: true })
	})

	it('does not navigate when the username is unchanged', async () => {
		vi.mocked(api).mockResolvedValue(saved_user('oldname'))
		await save_with_username('oldname')

		await vi.waitFor(() => expect(api).toHaveBeenCalledTimes(1))
		expect(goto).not.toHaveBeenCalled()
	})

	it('does not navigate when the save fails', async () => {
		vi.mocked(api).mockRejectedValue(new Error('Username is already taken'))
		await save_with_username('newname')

		await expect.element(page.getByRole('alert')).toHaveTextContent('Username is already taken')
		expect(goto).not.toHaveBeenCalled()
	})
})
