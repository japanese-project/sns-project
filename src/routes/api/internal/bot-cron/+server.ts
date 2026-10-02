import { error, json } from '@sveltejs/kit'
import { dev } from '$app/environment'
import { env } from '$env/dynamic/private'
import { run_bot_cycle } from '$lib/server/bot/runner'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ request, locals, platform }) => {
	// 1. Authorize: Header verification
	const auth_header = request.headers.get('authorization')
	const header_secret = request.headers.get('x-bot-cron-secret')
	const token = auth_header?.startsWith('Bearer ')
		? auth_header.slice(7).trim()
		: header_secret?.trim()

	const configured_secret =
		platform?.env?.BOT_CRON_SECRET ?? env.BOT_CRON_SECRET ?? process.env.BOT_CRON_SECRET

	const is_authorized = Boolean(
		(configured_secret && token === configured_secret) ||
		(!configured_secret && dev && token === 'dev-secret'),
	)

	if (!is_authorized) {
		throw error(401, 'Unauthorized: Invalid or missing bot cron secret')
	}

	// 2. Run bot cycle
	const llm_env = {
		GROQ_API_KEY: platform?.env?.GROQ_API_KEY ?? env.GROQ_API_KEY ?? process.env.GROQ_API_KEY,
		OPENAI_API_KEY:
			platform?.env?.OPENAI_API_KEY ?? env.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY,
	}

	const result = await run_bot_cycle(locals.db, llm_env, {
		kv: platform?.env?.AUTH_KV,
	})
	return json(result)
}
