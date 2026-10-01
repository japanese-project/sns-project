// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

import type { User, Session } from 'better-auth/types'
import type { Db } from '$lib/server/db'

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			db: Db
			user:
				| (User & {
						username?: string | null
						bio?: string | null
						interests?: string | null
						onboarded?: boolean | null
				  })
				| null
			session: Session | null
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				DB: D1Database
				AUTH_KV: KVNamespace
			}
		}
	}
}

export {}
