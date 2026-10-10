import { page } from 'vitest/browser'
import { beforeEach, describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { get } from 'svelte/store'
import { locale, set_locale } from '$lib/i18n'
import LanguageSelect from './LanguageSelect.svelte'

// The locale store is module-global, so each test states the locale it starts from rather than
// relying on the previous test's state.
beforeEach(async () => {
	await set_locale('en')
})

describe('LanguageSelect', () => {
	it('offers every supported locale in its own language', async () => {
		render(LanguageSelect)

		await expect.element(page.getByRole('button', { name: 'EN' })).toBeInTheDocument()
		await expect.element(page.getByRole('button', { name: '日本語' })).toBeInTheDocument()
		await expect.element(page.getByRole('button', { name: 'ខ្មែរ' })).toBeInTheDocument()
	})

	it('marks the active locale as pressed', async () => {
		await set_locale('ja')
		render(LanguageSelect)

		await expect
			.element(page.getByRole('button', { name: '日本語' }))
			.toHaveAttribute('aria-pressed', 'true')
		await expect
			.element(page.getByRole('button', { name: 'EN' }))
			.toHaveAttribute('aria-pressed', 'false')
	})

	it('switches the active locale on click', async () => {
		render(LanguageSelect)

		await page.getByRole('button', { name: 'ខ្មែរ' }).click()

		await expect.poll(() => get(locale)).toBe('km')
	})

	it('translates its own accessible name', async () => {
		render(LanguageSelect)

		await expect.element(page.getByRole('group', { name: 'Language' })).toBeInTheDocument()

		await page.getByRole('button', { name: '日本語' }).click()

		await expect.element(page.getByRole('group', { name: '言語' })).toBeInTheDocument()
	})
})

// The nav rail uses a single icon button that opens a menu, so a single icon is all the dock shows.
describe('LanguageSelect (icon variant)', () => {
	it('shows only one trigger and no locale buttons until the menu opens', async () => {
		render(LanguageSelect, { variant: 'icon' })

		const trigger = page.getByRole('button', { name: 'Change language' })
		await expect.element(trigger).toBeVisible()
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'false')
		await expect.element(page.getByRole('menu')).not.toBeInTheDocument()
		await expect.element(page.getByRole('button', { name: 'EN' })).not.toBeInTheDocument()
	})

	it('lists every supported locale by its own name when opened', async () => {
		render(LanguageSelect, { variant: 'icon' })

		await page.getByRole('button', { name: 'Change language' }).click()

		await expect.element(page.getByRole('menu', { name: 'Language' })).toBeVisible()
		await expect.element(page.getByRole('menuitemradio', { name: 'English' })).toBeVisible()
		await expect.element(page.getByRole('menuitemradio', { name: '日本語' })).toBeVisible()
		await expect.element(page.getByRole('menuitemradio', { name: 'ខ្មែរ' })).toBeVisible()
	})

	it('marks the active locale as the checked item', async () => {
		await set_locale('ja')
		render(LanguageSelect, { variant: 'icon' })

		// The trigger is labelled in the active language, so it reads 言語を変更 here.
		await page.getByRole('button', { name: '言語を変更' }).click()

		await expect
			.element(page.getByRole('menuitemradio', { name: '日本語' }))
			.toHaveAttribute('aria-checked', 'true')
		await expect
			.element(page.getByRole('menuitemradio', { name: 'English' }))
			.toHaveAttribute('aria-checked', 'false')
	})

	it('switches the active locale and closes the menu on click', async () => {
		render(LanguageSelect, { variant: 'icon' })

		await page.getByRole('button', { name: 'Change language' }).click()
		await page.getByRole('menuitemradio', { name: 'ខ្មែរ' }).click()

		await expect.poll(() => get(locale)).toBe('km')
		await expect.element(page.getByRole('menu')).not.toBeInTheDocument()
	})

	it('translates its own accessible name', async () => {
		render(LanguageSelect, { variant: 'icon' })

		await expect.element(page.getByRole('button', { name: 'Change language' })).toBeVisible()

		await page.getByRole('button', { name: 'Change language' }).click()
		await page.getByRole('menuitemradio', { name: '日本語' }).click()

		await expect.element(page.getByRole('button', { name: '言語を変更' })).toBeVisible()
	})

	it('opens with ArrowDown and moves focus between items, closing on Escape', async () => {
		render(LanguageSelect, { variant: 'icon' })

		const trigger = page.getByRole('button', { name: 'Change language' })
		trigger.element().focus()

		trigger
			.element()
			.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
		await expect.element(page.getByRole('menu', { name: 'Language' })).toBeVisible()

		const menu = page.getByRole('menu', { name: 'Language' }).element()
		const english = page.getByRole('menuitemradio', { name: 'English' }).element()
		const japanese = page.getByRole('menuitemradio', { name: '日本語' }).element()

		// ArrowDown focuses the first item.
		expect(document.activeElement).toBe(english)

		menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
		expect(document.activeElement).toBe(japanese)

		menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
		expect(document.activeElement).toBe(english)

		menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
		await expect.element(page.getByRole('menu')).not.toBeInTheDocument()
		expect(document.activeElement).toBe(trigger.element())
	})

	it('closes the menu on an outside click', async () => {
		render(LanguageSelect, { variant: 'icon' })

		await page.getByRole('button', { name: 'Change language' }).click()
		await expect.element(page.getByRole('menu', { name: 'Language' })).toBeVisible()

		document.body.click()

		await expect.element(page.getByRole('menu')).not.toBeInTheDocument()
	})
})
