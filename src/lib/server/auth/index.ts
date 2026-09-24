// Better Auth server-side configuration.
//
// This module exports a factory that creates a Better Auth instance
// per request, because Cloudflare Workers provide the D1 binding and
// KV binding through the platform env which is only available at
// request time.

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { drizzle } from 'drizzle-orm/d1'
import { env } from '$env/dynamic/private'
import * as schema from '$lib/server/db/schema'
import { create_kv_storage } from './kv-storage'

export function create_auth(d1: D1Database, kv: KVNamespace) {
	const db = drizzle(d1, { schema })

	return betterAuth({
		secret: env_or_throw('BETTER_AUTH_SECRET'),
		baseURL: env_or_throw('BETTER_AUTH_URL'),

		database: drizzleAdapter(db, {
			provider: 'sqlite',
			schema,
		}),

		secondaryStorage: create_kv_storage(kv),

		emailAndPassword: {
			enabled: false,
		},

		socialProviders: {
			google: {
				clientId: env_or_throw('GOOGLE_CLIENT_ID'),
				clientSecret: env_or_throw('GOOGLE_CLIENT_SECRET'),
			},
		},

		trustedOrigins: [env_or_throw('BETTER_AUTH_URL')],
	})
}

function env_or_throw(name: string): string {
	const value = env[name] ?? process.env[name]
	if (!value) {
		throw new Error(`Missing environment variable: ${name}`)
	}
	return value
}

export type Auth = ReturnType<typeof create_auth>
