import type { BotPersona } from './personas'
import type { FeedItem } from './rss'
import { MAX_POST_LENGTH } from '$lib/limits'

interface LLMEnv {
	GROQ_API_KEY?: string
	OPENAI_API_KEY?: string
}

const template_openers: Record<string, string[]> = {
	bot_vibe_coder: [
		'Tested this out today, workflow feels super smooth.',
		'Vibe coding is moving fast. Check this out:',
		'Really loving how fast you can iterate on stuff like this now.',
	],
	bot_agent_flow: [
		'Autonomous agent workflows are evolving quickly.',
		'Fascinating architectural direction for AI agents:',
		'Tool-use and multi-agent coordination getting better every week.',
	],
	bot_oss_watcher: [
		'Great open-source project worth starring on GitHub:',
		'Clean architecture and minimal dependencies. Take a look:',
		'Always appreciate well-crafted dev tools like this:',
	],
	bot_ai_dispatch: [
		'Notable release in the AI space today:',
		'New benchmark results and model details worth looking at:',
		'Big step forward for foundation models:',
	],
	bot_learn_code: [
		'Found this really helpful while digging into dev concepts:',
		'Solid breakdown for anyone building modern web apps:',
		'Great reference to bookmark for later:',
	],
	bot_manga_pulse: [
		'The panel composition and pacing in this are incredible:',
		'Weekly recommendation for manga readers:',
		'Can we talk about the latest developments here?',
	],
	bot_anime_slate: [
		'Animation quality and direction looking sharp:',
		'Definitely keeping this on my seasonal watchlist:',
		'The studio really went all out on this one:',
	],
	bot_coffee_dial: [
		'Dialing in this morning’s brew. Fascinating read on coffee origins:',
		'For anyone obsessed with pour-overs and extraction notes:',
		'Love seeing the craft and dedication in specialty coffee right now:',
	],
	bot_macro_pulse: [
		'Key economic indicators to watch this quarter:',
		'Interesting macro shifts and market dynamics unfolding:',
		'Worth keeping an eye on these broader trends:',
	],
	default: [
		'Came across this and wanted to share:',
		'Interesting perspective worth reading:',
		'Thoughts on this?',
	],
}

export async function generate_post_content(
	persona: BotPersona,
	item: FeedItem,
	env: LLMEnv,
): Promise<string> {
	const hashtags = persona.hashtags.slice(0, 3).join(' ')
	const prompt = `You are a user on a modern social network. Your persona:
${persona.tonePrompt}

Here is a news item:
Title: "${item.title}"
${item.description ? `Summary: "${item.description}"` : ''}

Write a natural, conversational social media post about this.
Rules:
- 1 or 2 sentences ONLY.
- Express a brief human reaction, opinion, or question.
- Do NOT include the link or hashtags (we will append them automatically).
- Do NOT use quotation marks around your entire response.
- Maximum 180 characters.`

	// Try Groq first, then OpenAI if available
	const api_key = env.GROQ_API_KEY || env.OPENAI_API_KEY
	const endpoint = env.GROQ_API_KEY
		? 'https://api.groq.com/openai/v1/chat/completions'
		: 'https://api.openai.com/v1/chat/completions'
	const model = env.GROQ_API_KEY ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'

	if (api_key) {
		try {
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${api_key}`,
				},
				body: JSON.stringify({
					model,
					messages: [
						{ role: 'system', content: persona.tonePrompt },
						{ role: 'user', content: prompt },
					],
					temperature: 0.7,
					max_tokens: 120,
				}),
			})

			if (res.ok) {
				const data = (await res.json()) as {
					choices?: [{ message?: { content?: string } }]
				}
				const commentary = data.choices?.[0]?.message?.content?.trim()
				if (commentary) {
					const clean = commentary.replace(/^["']|["']$/g, '').trim()
					const full_post = `${clean}\n\n${item.title}\n${item.link}\n\n${hashtags}`
					if (full_post.length <= MAX_POST_LENGTH) {
						return full_post
					}
				}
			}
		} catch (err) {
			console.warn('[Bot LLM] Failed to generate with LLM, using template fallback:', err)
		}
	}

	// High quality template fallback
	const pool = template_openers[persona.id] ?? template_openers.default
	const intro = pool[Math.floor(Math.random() * pool.length)]

	let post = `${intro}\n\n${item.title}\n${item.link}\n\n${hashtags}`
	if (post.length > MAX_POST_LENGTH) {
		post = `${item.title}\n${item.link}\n\n${hashtags}`
	}
	return post.slice(0, MAX_POST_LENGTH)
}
