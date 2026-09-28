import { defineConfig } from 'drizzle-kit'

// accountId/databaseId/token are only read by `drizzle-kit studio` and
// `drizzle-kit push` (the D1 HTTP driver talks to Cloudflare's REST API
// directly). `db:migrate:local` / `db:migrate:remote` go through wrangler's
// own login session and don't need these. See .env.example.
export default defineConfig({
	schema: './src/lib/server/db/schema/index.ts',
	out: './src/lib/server/db/migrations',
	dialect: 'sqlite',
	driver: 'd1-http',
	casing: 'snake_case',
	dbCredentials: {
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
		databaseId: process.env.CLOUDFLARE_DATABASE_ID ?? '',
		token: process.env.CLOUDFLARE_D1_TOKEN ?? '',
	},
})
