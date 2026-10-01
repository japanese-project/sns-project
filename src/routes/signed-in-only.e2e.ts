import { expect, test } from '@playwright/test'

// The app is for signed-in users only: a visitor without a session is sent to the sign-in page,
// whichever page they ask for, and never sees any app content.
for (const path of [
	'/',
	'/explore',
	'/notifications',
	'/profile',
	'/u/someone',
	'/posts/some-id',
]) {
	test(`${path} sends a signed-out visitor to the sign-in page`, async ({ page }) => {
		await page.goto(path)
		await expect(page).toHaveURL(/\/login$/)
		await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()
	})
}
