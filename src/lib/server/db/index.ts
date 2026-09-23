import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

export function create_db(d1: D1Database) {
	return drizzle(d1, { schema })
}

export type Db = ReturnType<typeof create_db>
