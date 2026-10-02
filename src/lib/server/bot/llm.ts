import type { BotPersona } from './personas'
import type { FeedItem } from './rss'
import { MAX_POST_LENGTH } from '$lib/limits'

interface LLMEnv {
	GROQ_API_KEY?: string
	OPENAI_API_KEY?: string
}

// Varied contextual commentary openers for template fallbacks
const topic_templates: Record<
	string,
	Array<{
		format: (item: FeedItem, hashtag: string) => string
	}>
> = {
	tech: [
		{
			format: (item, tag) =>
				`Shipped with speed. Really loving how fast tooling is moving in this space:\n\n${item.title}\n${item.link} ${tag}`.trim(),
		},
		{
			format: (item) =>
				`"${item.title}"\n\nFascinating architectural direction. Clean, high leverage, and practical:\n${item.link}`.trim(),
		},
		{
			format: (item, tag) =>
				`Curious what everyone thinks about this approach:\n\n${item.title}\n${item.link} ${tag}`.trim(),
		},
		{
			format: (item) =>
				`${item.title} — solid breakdown worth bookmarking for your next build:\n\n${item.link}`.trim(),
		},
	],
	anime: [
		{
			format: (item, tag) =>
				`The visual direction and pacing on this looking so clean:\n\n${item.title}\n${item.link} ${tag}`.trim(),
		},
		{
			format: (item) =>
				`"${item.title}"\n\nBeen waiting for official updates on this. The hype is very real:\n${item.link}`.trim(),
		},
		{
			format: (item, tag) =>
				`Adding this straight to the watchlist. Thoughts on this adaptation?\n\n${item.title}\n${item.link} ${tag}`.trim(),
		},
	],
	movie: [
		{
			format: (item, tag) =>
				`Casting and cinematography looking incredible here. What do we think?\n\n${item.title}\n${item.link} ${tag}`.trim(),
		},
		{
			format: (item) =>
				`"${item.title}"\n\nA bold creative direction. Really interested in how audiences react:\n${item.link}`.trim(),
		},
	],
	economic: [
		{
			format: (item, tag) =>
				`Key macro indicators and structural shifts to keep an eye on:\n\n${item.title}\n${item.link} ${tag}`.trim(),
		},
		{
			format: (item) =>
				`"${item.title}"\n\nSignificant ripple effects here across markets and liquidity:\n${item.link}`.trim(),
		},
	],
	cafe: [
		{
			format: (item, tag) =>
				`Dialing in the morning brew. Beautiful story on craftsmanship and origins:\n\n${item.title}\n${item.link} ${tag}`.trim(),
		},
		{
			format: (item) =>
				`"${item.title}"\n\nCozy vibes, thoughtful notes, and pure appreciation for the process:\n${item.link}`.trim(),
		},
	],
	default: [
		{
			format: (item, tag) =>
				`Really thoughtful perspective on this:\n\n${item.title}\n${item.link} ${tag}`.trim(),
		},
		{
			format: (item) =>
				`"${item.title}"\n\nWorth a read if you've been following these developments:\n${item.link}`.trim(),
		},
		{
			format: (item, tag) =>
				`Fascinating takeaway from today's news:\n\n${item.title}\n${item.link} ${tag}`.trim(),
		},
	],
}

// Fallback comments tailored to topics
const topic_comments: Record<string, string[]> = {
	tech: [
		'Really interested to see how this performs in production.',
		'The speed of iteration here is genuinely wild.',
		'Big fan of this approach over traditional complex setups.',
		'Curious what the developer ergonomics look like in practice.',
		'Definitely saving this to test out later this week.',
		'Such a clean design choice. Love seeing this ship.',
	],
	anime: [
		'The animation in this arc was absolutely peak.',
		'Really hoping they give this the budget and schedule it deserves!',
		'Adding this straight to the watchlist for this weekend.',
		'The pacing in the manga was incredible around here.',
		'Can never get enough of this art style.',
	],
	movie: [
		'The cinematography in the preview looked incredible.',
		'Visually looks stunning, really hoping the script holds up.',
		'Count me in for opening weekend.',
		'Bold direction from the team, curious how audiences take it.',
	],
	economic: [
		'Huge implications for the broader macro cycle.',
		'The unit economics on this make a ton of sense.',
		'Watching closely how this plays out over the next quarter.',
		'Interesting to see how market expectations are adjusting.',
	],
	cafe: [
		'Such a great cozy atmosphere, adding this to my travel list.',
		'Dialing in the right roast and ratio makes all the difference.',
		'That aesthetic is unmatched.',
		'Perfect setup for a quiet afternoon of reading.',
	],
	default: [
		'Super interesting takeaway, thanks for sharing this.',
		"Couldn't agree more with this perspective.",
		'Curious how this will look a year from now.',
		'Great point, definitely worth keeping in mind.',
		'Spot on. Really resonated with this part.',
	],
}

function get_category_key(persona: BotPersona): string {
	const topics = persona.topics ?? []
	if (
		topics.some((t) =>
			['vibecoding', 'ai', 'agent', 'opensource', 'tools', 'coding', 'webdev'].includes(t),
		)
	)
		return 'tech'
	if (topics.some((t) => ['anime', 'manga', 'reading', 'shonen', 'animation'].includes(t)))
		return 'anime'
	if (topics.some((t) => ['movie', 'entertainment', 'streaming', 'humor', 'meme'].includes(t)))
		return 'movie'
	if (topics.some((t) => ['economic', 'markets', 'startup', 'finance'].includes(t)))
		return 'economic'
	if (topics.some((t) => ['cafe', 'coffee', 'lifestyle'].includes(t))) return 'cafe'
	return 'default'
}

/**
 * Generate an authentic, varied social media post for a given news item.
 */
export async function generate_post_content(
	persona: BotPersona,
	item: FeedItem,
	env: LLMEnv,
): Promise<string> {
	const primary_tag = persona.hashtags[0] ?? ''
	const category = get_category_key(persona)

	const prompt = `You are a real user on a social network (like Twitter/Bluesky).
Your persona: ${persona.tonePrompt}

Here is a news item from a trusted source:
Headline: "${item.title}"
${item.description ? `Summary: "${item.description.slice(0, 200)}"` : ''}
Link: ${item.link}

Write a captivating social post (under 280 characters).
Key rules:
- Vary your structure naturally:
  * You can lead with a hook/opinion, followed by the headline and link.
  * Or quote the headline and share your hot take.
  * Or ask a thought-provoking question to start a conversation.
- Sounds human, authentic, and matches your persona tone.
- Include the link naturally: ${item.link}
- You can optionally end with ${primary_tag} if it fits, or no hashtag.
- Do NOT wrap your entire response in quotes.
- Do NOT use robotic, repetitive phrasing.`

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
					temperature: 0.8,
					max_tokens: 150,
				}),
			})

			if (res.ok) {
				const data = (await res.json()) as {
					choices?: [{ message?: { content?: string } }]
				}
				const generated = data.choices?.[0]?.message?.content?.trim()
				if (generated) {
					const clean = generated.replace(/^["']|["']$/g, '').trim()
					// Verify it includes the link; if LLM omitted it, append it cleanly
					const final_post = clean.includes(item.link)
						? clean
						: `${clean}\n\n${item.link} ${primary_tag}`.trim()

					if (final_post.length <= MAX_POST_LENGTH) {
						return final_post
					}
					return final_post.slice(0, MAX_POST_LENGTH - 3) + '...'
				}
			}
		} catch (err) {
			console.warn('[Bot LLM] Post generation failed, falling back to smart template:', err)
		}
	}

	// Smart fallback: pick a varied template
	const templates = topic_templates[category] ?? topic_templates.default
	const chosen = templates[Math.floor(Math.random() * templates.length)]
	const fallback_post = chosen.format(item, primary_tag)

	if (fallback_post.length <= MAX_POST_LENGTH) {
		return fallback_post
	}
	return `${item.title}\n\n${item.link}`
}

/**
 * Generate a short, in-character social media comment reacting to an existing post.
 */
export async function generate_bot_comment(
	persona: BotPersona,
	target_post_content: string,
	env: LLMEnv,
): Promise<string> {
	const category = get_category_key(persona)

	const prompt = `You are replying to a post on a social media app.
Your persona: ${persona.tonePrompt}

The post you are replying to:
"${target_post_content.slice(0, 240)}"

Write a short, natural, human reply (1 sentence, max 100 characters).
Rules:
- Sound like a real person having a quick conversation (agree, share an insight, ask a short question, or express excitement).
- Do NOT use hashtags in comments.
- Do NOT use quotation marks.
- Keep it under 100 characters.`

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
					temperature: 0.8,
					max_tokens: 60,
				}),
			})

			if (res.ok) {
				const data = (await res.json()) as {
					choices?: [{ message?: { content?: string } }]
				}
				const generated = data.choices?.[0]?.message?.content?.trim()
				if (generated) {
					return generated
						.replace(/^["']|["']$/g, '')
						.replace(/#\w+/g, '')
						.trim()
						.slice(0, 140)
				}
			}
		} catch (err) {
			console.warn('[Bot LLM] Comment generation failed, using fallback:', err)
		}
	}

	// Fallback comment
	const comments = topic_comments[category] ?? topic_comments.default
	return comments[Math.floor(Math.random() * comments.length)]
}
