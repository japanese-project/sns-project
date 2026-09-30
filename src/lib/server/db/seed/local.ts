import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { seed, reset } from 'drizzle-seed'

import { user, post, comment, like, follow } from '../schema'

const database_url =
	'.wrangler/state/v3/d1/miniflare-D1DatabaseObject/ab563b834034ed60acd0afedbb88cdce791afcd89601c31c7ee07fb1d883f880.sqlite'

async function main() {
	const client = new Database(database_url)
	const db = drizzle(client)

	await reset(db, { user, post, comment, like, follow })

	await seed(db, { user, post, comment }).refine((f) => ({
		user: {
			count: 10,
			columns: {
				id: f.uuid(),
				email: f.email(),
			},
		},
		post: {
			count: 20,
			columns: {
				id: f.uuid(),
				visibility: f.valuesFromArray({ values: ['public', 'followers-only'] }),
			},
		},
		comment: {
			count: 40,
			columns: {
				id: f.uuid(),
				parentId: f.default({ defaultValue: null }),
			},
		},
	}))

	const all_users = await db.select({ id: user.id }).from(user)
	const all_posts = await db.select({ id: post.id }).from(post)

	const likes = all_posts.flatMap((p) =>
		all_users.slice(0, 3).map((u) => ({
			postId: p.id,
			userId: u.id,
		})),
	)

	const follows = all_users.slice(1).map((u) => ({
		followerId: u.id,
		followingId: all_users[0].id,
	}))

	await db.insert(like).values(likes)
	await db.insert(follow).values(follows)

	client.close()
}

main()
