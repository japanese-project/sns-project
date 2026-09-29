// Better Auth client for Svelte.
//
// Provides reactive $session store and sign-in / sign-out helpers
// that components can import directly.

import { createAuthClient } from 'better-auth/svelte'

export const auth_client = createAuthClient()

export const sign_in_with_google = () =>
	auth_client.signIn.social({
		provider: 'google',
		callbackURL: '/',
	})

export const sign_out = () => auth_client.signOut()
