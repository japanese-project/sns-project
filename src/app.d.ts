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
						isAdmin?: boolean
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
				MEDIA_BUCKET: R2Bucket
				BOT_CRON_SECRET?: string
				GROQ_API_KEY?: string
				OPENAI_API_KEY?: string
				ADMIN_EMAILS?: string
				ADMIN_USERNAMES?: string
				ADMIN_USER_IDS?: string
				ADMIN_SECRET?: string
			}
		}
	}
}

export {}
