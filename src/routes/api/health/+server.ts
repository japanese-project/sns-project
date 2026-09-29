import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ platform }) => {
	const checks: Record<string, string> = {}
	let has_error = false

	if (platform?.env?.DB) {
		try {
			await platform.env.DB.prepare('SELECT 1').run()
			checks.d1 = 'ok'
		} catch (error) {
			has_error = true
			checks.d1 = error instanceof Error ? error.message : 'D1 check failed'
		}
	} else {
		checks.d1 = 'binding_missing'
	}

	if (platform?.env?.AUTH_KV) {
		try {
			await platform.env.AUTH_KV.get('__health__')
			checks.kv = 'ok'
		} catch (error) {
			has_error = true
			checks.kv = error instanceof Error ? error.message : 'KV check failed'
		}
	} else {
		checks.kv = 'binding_missing'
	}

	const status = has_error ? 503 : 200

	return json(
		{
			status: has_error ? 'degraded' : 'healthy',
			timestamp: new Date().toISOString(),
			checks,
		},
		{ status },
	)
}
