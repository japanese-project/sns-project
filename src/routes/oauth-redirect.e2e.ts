import { expect, test } from '@playwright/test'

// Google sign-in only completes if the redirect URI Better Auth generates points back at the host
// the browser is actually on. That pairing lives in config (BETTER_AUTH_URL) rather than in code,
// so nothing else catches it: when the two disagree — a forwarded dev URL, a codespace port
// forward, a preview deploy — Google authenticates the user and then sends the browser to a host
// the app is not running on, which surfaces as "sign-in is broken" with no server-side error.
//
// `signed-in-only.e2e.ts` only asserts the Google button renders, which is why this went unnoticed.

test('the Google sign-in redirect URI points back at the app origin', async ({
	request,
	baseURL,
}) => {
	const response = await request.post('/api/auth/sign-in/social', {
		data: { provider: 'google', callbackURL: '/' },
	})

	expect(response.status()).toBe(200)

	const { url } = (await response.json()) as { url: string }
	expect(url, 'sign-in/social must return the provider URL to redirect to').toBeTruthy()

	const redirect_uri = new URL(url).searchParams.get('redirect_uri')
	expect(redirect_uri, 'provider URL must carry a redirect_uri').toBeTruthy()

	// The callback has to land on this deployment, not on some other origin.
	expect(new URL(redirect_uri!).origin).toBe(new URL(baseURL!).origin)
	expect(new URL(redirect_uri!).pathname).toBe('/api/auth/callback/google')
})
