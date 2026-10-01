// Test helper: a real D1 database (workerd via wrangler's platform proxy) with the actual
// migrations applied, so service tests exercise real SQL, FK cascades and unique indexes.
import fs from 'node:fs'
import path from 'node:path'
import { getPlatformProxy } from 'wrangler'
import { create_db, type Db } from '../db'
import { user, follow } from '../db/schema'

export async function create_test_db(): Promise<{ db: Db; dispose: () => Promise<void> }> {
	const proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: false })
	const d1 = proxy.env.DB
	// getPlatformProxy shares one in-memory store per process; start from a clean slate.
	const dir = path.resolve('src/lib/server/db/migrations')
	await d1.exec('PRAGMA foreign_keys = ON')
	const existing = await d1
		.prepare(
			"select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '_cf_%'",
		)
		.all<{ name: string }>()
	for (const row of existing.results) await d1.exec(`DROP TABLE IF EXISTS "${row.name}"`)
	for (const file of fs
		.readdirSync(dir)
		.filter((f) => f.endsWith('.sql'))
		.sort()) {
		const sql = fs.readFileSync(path.join(dir, file), 'utf8')
		for (const statement of sql.split('--> statement-breakpoint')) {
			if (statement.trim()) await d1.prepare(statement).run()
		}
	}
	return { db: create_db(d1), dispose: () => proxy.dispose() }
}

export async function make_user(db: Db, name: string) {
	const id = crypto.randomUUID()
	const now = new Date()
	await db.insert(user).values({
		id,
		name,
		email: `${name.toLowerCase()}-${id.slice(0, 6)}@example.com`,
		username: name.toLowerCase(),
		createdAt: now,
		updatedAt: now,
	})
	return id
}

export async function make_follow(db: Db, follower_id: string, following_id: string) {
	await db.insert(follow).values({ followerId: follower_id, followingId: following_id })
}
