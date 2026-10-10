import { expect, test } from '@playwright/test'

// The locale is negotiated from Accept-Language during SSR, so these assertions cover the
// server-rendered HTML too — a client-only check would pass even if SSR emitted raw keys or the
// wrong language and only corrected itself on hydration.
//
// `test.use({ locale })` is what makes Playwright send the matching Accept-Language header;
// `page.goto(url, { locale })` sets the context locale for the document but does not re-send the
// header on navigation, so the server would still negotiate from the default.
test.describe('localization', () => {
	test.use({ locale: 'en-US' })

	test('renders English and tags the document', async ({ page }) => {
		await page.goto('/login')

		await expect(page.locator('html')).toHaveAttribute('lang', 'en')
		await expect(page.getByRole('heading', { name: 'Sign in to Loop' })).toBeVisible()
	})

	test('shows no untranslated keys in English', async ({ page }) => {
		await page.goto('/login')

		const body = await page.locator('body').innerText()
		// A missing translation renders as its own key, so any dotted key on screen is a gap.
		expect(body).not.toMatch(/\b(login|common|nav|language|post|composer)\.[a-z_]+/)
	})

	test('switches language from the login page selector', async ({ page }) => {
		await page.goto('/login')

		await page.getByRole('button', { name: '日本語' }).click()

		await expect(page.getByRole('heading', { name: 'Loopにログイン' })).toBeVisible()
		await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
		await expect(page.getByRole('button', { name: 'Googleで続ける' })).toBeVisible()
	})
})

test.describe('localization: Japanese', () => {
	test.use({ locale: 'ja-JP' })

	test('server-renders Japanese and tags the document', async ({ page }) => {
		await page.goto('/login')

		await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
		await expect(page.getByRole('heading', { name: 'Loopにログイン' })).toBeVisible()
	})

	test('shows no untranslated keys in Japanese', async ({ page }) => {
		await page.goto('/login')

		const body = await page.locator('body').innerText()
		expect(body).not.toMatch(/\b(login|common|nav|language|post|composer)\.[a-z_]+/)
	})
})

test.describe('localization: Khmer', () => {
	test.use({ locale: 'km-KH' })

	test('server-renders Khmer and tags the document', async ({ page }) => {
		await page.goto('/login')

		await expect(page.locator('html')).toHaveAttribute('lang', 'km')
		await expect(page.getByRole('heading', { name: 'ចូលទៅ Loop' })).toBeVisible()
	})

	test('shows no untranslated keys in Khmer', async ({ page }) => {
		await page.goto('/login')

		const body = await page.locator('body').innerText()
		expect(body).not.toMatch(/\b(login|common|nav|language|post|composer)\.[a-z_]+/)
	})
})

test.describe('localization: unsupported language', () => {
	test.use({ locale: 'fr-FR' })

	test('falls back to English', async ({ page }) => {
		await page.goto('/login')

		await expect(page.locator('html')).toHaveAttribute('lang', 'en')
		await expect(page.getByRole('heading', { name: 'Sign in to Loop' })).toBeVisible()
	})
})
