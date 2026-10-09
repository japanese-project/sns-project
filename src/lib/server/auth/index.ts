// Better Auth server-side configuration.
//
// This module exports a factory that creates a Better Auth instance
// per request, because Cloudflare Workers provide the D1 binding and
// KV binding through the platform env which is only available at
// request time.

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { oAuthProxy } from 'better-auth/plugins'
import { drizzle } from 'drizzle-orm/d1'
import { env } from '$env/dynamic/private'
import * as schema from '$lib/server/db/schema'
import { create_kv_storage } from './kv-storage'

const default_production_url = 'https://sns-project.sreng087.workers.dev'
const default_local_url = 'http://localhost:5555'

export function create_auth(d1: D1Database, kv: KVNamespace) {
	const db = drizzle(d1, { schema })
	const current_url = env_or_default('BETTER_AUTH_URL', default_local_url)
	const production_url = env.PRODUCTION_URL ?? process.env.PRODUCTION_URL ?? default_production_url
	const is_local = current_url.includes('localhost') || current_url.includes('127.0.0.1')

	return betterAuth({
		secret: env_or_throw('BETTER_AUTH_SECRET'),
		baseURL: current_url,

		database: drizzleAdapter(db, {
			provider: 'sqlite',
			schema,
		}),

		secondaryStorage: create_kv_storage(kv),

		user: {
			additionalFields: {
				username: { type: 'string', required: false, input: false },
				bio: { type: 'string', required: false, input: false },
				interests: { type: 'string', required: false, input: false },
				onboarded: { type: 'boolean', required: false, input: false },
			},
		},

		emailAndPassword: {
			enabled: false,
		},

		socialProviders: {
			google: {
				clientId: env_or_throw('GOOGLE_CLIENT_ID'),
				clientSecret: env_or_throw('GOOGLE_CLIENT_SECRET'),
			},
		},

		plugins: is_local
			? []
			: [
					oAuthProxy({
						productionURL: production_url,
						currentURL: current_url,
					}),
				],

		// Better Auth rejects state-changing requests whose Origin is not in this list. The four
		// built-in entries cover local dev and the deployed workers; TRUSTED_ORIGINS adds more
		// (comma-separated) for environments whose host is not known ahead of time, such as a
		// forwarded dev codespace URL, so it does not have to be a source edit.
		trustedOrigins: [
			current_url,
			production_url,
			'https://*.sreng087.workers.dev',
			'http://localhost:5555',
			...extra_origins(),
		],
	})
}

function env_or_throw(name: string): string {
	const value = env[name] ?? process.env[name]
	if (!value) {
		throw new Error(`Missing environment variable: ${name}`)
	}
	return value
}

function env_or_default(name: string, fallback: string): string {
	return env[name] || process.env[name] || fallback
}

// Comma-separated origins to trust in addition to the built-in list. Blank entries are dropped so
// a trailing comma or an unset variable cannot add an empty (and always-rejected) origin.
function extra_origins(): string[] {
	const raw = env.TRUSTED_ORIGINS ?? process.env.TRUSTED_ORIGINS ?? ''
	return raw
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean)
}

export type Auth = ReturnType<typeof create_auth>
