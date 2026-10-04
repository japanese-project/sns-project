import type { BotPersona } from './personas'
import type { FeedItem } from './rss'
import { MAX_POST_LENGTH } from '$lib/limits'

interface LLMEnv {
	GROQ_API_KEY?: string
	OPENAI_API_KEY?: string
}

interface PersonaPostStyle {
	structureInstruction: string
	templates: Array<(item: FeedItem, primaryTag: string) => string>
	commentStyle: string[]
}

/**
 * Safely extracts a clean, grounded summary from the item description if available.
 */
function get_grounded_excerpt(item: FeedItem, max_len = 120): string {
	if (!item.description) return ''
	const clean = item.description
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
	if (!clean || clean.length < 15) return ''
	return clean.length <= max_len ? clean : clean.slice(0, max_len - 3) + '...'
}

/**
 * Unique signature post structures and templates for every bot persona.
 * All fallback templates are strictly grounded in item.title and item.description,
 * presenting persona reactions and structural framing without fabricating extraneous facts.
 */
export const PERSONA_POST_STYLES: Record<string, PersonaPostStyle> = {
	bot_vibe_coder: {
		structureInstruction: `Use high-energy vibe coding style. Start with "⚡ VIBE CHECK // " or "🛠️ Shipping fast today:". Mention rapid prototyping, tooling ergonomics, and speed. Quote headline and provide link. End with #vibecoding. Only refer to facts stated in the headline and summary.`,
		templates: [
			(item, tag) => {
				const excerpt = get_grounded_excerpt(item)
				return `⚡ VIBE CHECK // Shipping fast:\n"${item.title}"\n\n${excerpt ? `${excerpt}\n\n` : ''}👉 Read more: ${item.link} ${tag}`.trim()
			},
			(item, tag) =>
				`🛠️ Tooling & dev speed radar:\n"${item.title}"\n\nCatching up on this today:\n${item.link} ${tag}`.trim(),
			(item) =>
				`🚀 High leverage workflow find:\n"${item.title}"\n\nBookmark this:\n👉 ${item.link}`.trim(),
		],
		commentStyle: [
			'Super clean approach here.',
			'The dev ergonomics look great.',
			'Zero boilerplate vibes right here.',
		],
	},

	bot_agent_flow: {
		structureInstruction: `Use structured agent architect notes with bullet points (•). Include "🧠 Autonomous Agent Log:", reference the headline topic and summary directly, and provide actionable source context. End with link and #agents. Do not invent benchmark numbers or unsupported claims.`,
		templates: [
			(item, tag) => {
				const excerpt = get_grounded_excerpt(item, 100)
				return `🧠 Autonomous Agent Log:\n• Focus: "${item.title}"\n${excerpt ? `• Context: ${excerpt}\n` : ''}\nBreakdown & source:\n📄 ${item.link} ${tag}`.trim()
			},
			(item, tag) =>
				`🤖 Agentic Workflow Dispatch:\n"${item.title}"\n\n• Tracking this update and implementation details\n\nDetails: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Fascinating architecture implications.',
			'Definitely keeping an eye on this design.',
			'Autonomous workflows evolving quickly.',
		],
	},

	bot_oss_watcher: {
		structureInstruction: `Use pragmatic open source radar style. Start with "📦 Open Source Radar:" or "📦 Repo Spotlight:". Emphasize developer ergonomics, open source collaboration, and project details grounded strictly in the source. End with 🔗 link and #opensource.`,
		templates: [
			(item, tag) => {
				const excerpt = get_grounded_excerpt(item)
				return `📦 Open Source Radar:\n"${item.title}"\n\n${excerpt ? `${excerpt}\n\n` : ''}🔗 Source: ${item.link} ${tag}`.trim()
			},
			(item, tag) =>
				`💻 Open Source Gem Spotted:\n"${item.title}"\n\nLove seeing pragmatic tooling ship.\n\nCheck it out: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Love the clean architecture here.',
			'Great addition to the open source ecosystem.',
			'Starred and bookmarked.',
		],
	},

	bot_ai_dispatch: {
		structureInstruction: `Use breaking AI news wire style. Start with "🚨 AI DISPATCH // WIRE:". Include headline, followed by a sharp "⚡ Summary: " grounded only in the provided item. End with link and #ai.`,
		templates: [
			(item, tag) => {
				const excerpt = get_grounded_excerpt(item, 110)
				return `🚨 AI DISPATCH // WIRE:\n"${item.title}"\n\n${excerpt ? `⚡ Summary: ${excerpt}\n\n` : ''}📰 Full report: ${item.link} ${tag}`.trim()
			},
			(item, tag) =>
				`⚡ Breakthrough Pulse:\n"${item.title}"\n\nLatest update from the research & deployment frontier.\n\nRead dispatch: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Very interesting milestone if confirmed.',
			'Watching this space closely.',
			'High signal update right here.',
		],
	},

	bot_learn_code: {
		structureInstruction: `Use friendly coding mentor style. Start with "💡 Dev Learning Note:" or "💡 Quick Cheat Sheet:". Explain why it matters for learners based on the title and summary. Include 🔖 Bookmark callout with link and #webdev.`,
		templates: [
			(item, tag) => {
				const excerpt = get_grounded_excerpt(item, 100)
				return `💡 Dev Learning Note:\n"${item.title}"\n\n${excerpt ? `${excerpt}\n\n` : ''}🔖 Bookmark for later: ${item.link} ${tag}`.trim()
			},
			(item, tag) =>
				`🚀 Good read for developers leveling up:\n"${item.title}"\n\nClear mental models make all the difference.\n\nCheck it out: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Such a clean breakdown for this concept!',
			'Super helpful resource for developers.',
			'Bookmark worthy explanation.',
		],
	},

	bot_manga_pulse: {
		structureInstruction: `Use fan-driven weekly manga serialization impressions. Start with "📖 Weekly Manga Pulse //". Comment enthusiastically on the news or release grounded in the title. End with link and #manga.`,
		templates: [
			(item, tag) => {
				const excerpt = get_grounded_excerpt(item)
				return `📖 Weekly Manga Pulse //\n"${item.title}"\n\n${excerpt ? `${excerpt}\n\n` : ''}Read updates: ${item.link} ${tag}`.trim()
			},
			(item, tag) =>
				`🔥 Manga Serialization News:\n"${item.title}"\n\nExcited to see where this goes next!\n\nDetails: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'The storytelling here is so compelling.',
			'Chapter pacing was completely unmatched.',
			'The author delivered so well this week.',
		],
	},

	bot_anime_slate: {
		structureInstruction: `Use animation craft and studio enthusiast style. Start with "✨ Animation Dispatch:". Highlight visual direction or project announcement grounded in the title. End with link and #anime.`,
		templates: [
			(item, tag) => {
				const excerpt = get_grounded_excerpt(item)
				return `✨ Animation Dispatch:\n"${item.title}"\n\n${excerpt ? `${excerpt}\n\n` : ''}Watch / read: ${item.link} ${tag}`.trim()
			},
			(item, tag) =>
				`🎨 Anime Highlight:\n"${item.title}"\n\nExciting project details and announcements.\n\nDetails: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Visual direction looking fantastic.',
			'Top tier production values.',
			'Adding this straight to my watchlist.',
		],
	},

	bot_novel_hub: {
		structureInstruction: `Use deep reading & fiction enthusiast tone. Start with "📚 Story & Fiction Archive //". Ground comments in the story title and summary. End with link and #books.`,
		templates: [
			(item, tag) => {
				const excerpt = get_grounded_excerpt(item)
				return `📚 Story & Fiction Archive //\n"${item.title}"\n\n${excerpt ? `${excerpt}\n\n` : ''}Read details: ${item.link} ${tag}`.trim()
			},
			(item, tag) =>
				`🕯️ Fiction & Novel Radar:\n"${item.title}"\n\nAlways excited to explore new narrative worlds.\n\nSource: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'The premise here sounds really promising.',
			'Great character concepts.',
			'Adding this straight to my reading queue.',
		],
	},

	bot_otaku_takes: {
		structureInstruction: `Use engaging community debate starter style. Start with "💭 Community Discussion:" or "🔥 Discussion Prompt:". Ask followers for their thoughts grounded in the news headline. End with link and #animetwt.`,
		templates: [
			(item, tag) =>
				`💭 Community Discussion:\n"${item.title}"\n\nWhat are your thoughts on this announcement? Let's hear it in the replies 👇\n\nRead more: ${item.link} ${tag}`.trim(),
			(item, tag) => {
				const excerpt = get_grounded_excerpt(item, 90)
				return `🔥 Discussion Topic:\n"${item.title}"\n\n${excerpt ? `${excerpt}\n\n` : ''}Link: ${item.link} ${tag}`.trim()
			},
		],
		commentStyle: [
			'Curious to see what others think about this.',
			'This could go in multiple directions honestly.',
			'Definite discussion starter right here.',
		],
	},

	bot_shonen_buzz: {
		structureInstruction: `Use enthusiastic community excitement style. Start with "💥 NEW RELEASE ALERT //" or "⚡ LATEST DROP:". Express excitement grounded in the headline. End with link and #shonen.`,
		templates: [
			(item, tag) => {
				const excerpt = get_grounded_excerpt(item)
				return `💥 NEW RELEASE ALERT //\n"${item.title}"\n\n${excerpt ? `${excerpt}\n\n` : ''}LET'S GO: ${item.link} ${tag}`.trim()
			},
			(item, tag) =>
				`⚡ LATEST DROP:\n"${item.title}"\n\nHuge update for the community today!\n\nCheck it out: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'WE ARE SO BACK! Fantastic news.',
			'Incredible announcement right here.',
			'Cannot wait to check this out!',
		],
	},

	bot_cinema_scout: {
		structureInstruction: `Use thoughtful cinephile perspective. Start with "🎬 Cinema Scout Dispatch:". Reference director vision and project scope grounded in the headline. End with link and #cinema.`,
		templates: [
			(item, tag) => {
				const excerpt = get_grounded_excerpt(item)
				return `🎬 Cinema Scout Dispatch:\n"${item.title}"\n\n${excerpt ? `${excerpt}\n\n` : ''}Review & notes: ${item.link} ${tag}`.trim()
			},
			(item, tag) =>
				`📽️ Film & Story Spotlight:\n"${item.title}"\n\nA notable release on our radar.\n\nRead more: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Very curious to see how this translates on screen.',
			'A noteworthy direction in contemporary film.',
			'Directing and visual choices sound fascinating.',
		],
	},

	bot_stream_guide: {
		structureInstruction: `Use streaming recommendation tone. Start with "🍿 Watchlist Alert:" or "📺 What to Stream:". Ground the post strictly in the title and summary. End with link and #whattowatch.`,
		templates: [
			(item, tag) => {
				const excerpt = get_grounded_excerpt(item)
				return `🍿 Watchlist Alert:\n"${item.title}"\n\n${excerpt ? `${excerpt}\n\n` : ''}Details & info: ${item.link} ${tag}`.trim()
			},
			(item, tag) =>
				`📺 Streaming Guide Pick:\n"${item.title}"\n\nAdding this to the radar this week.\n\nCheck it out: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Adding this to tonight’s watchlist!',
			'Solid recommendation based on early impressions.',
			'Putting this on the queue.',
		],
	},

	bot_meme_vault: {
		structureInstruction: `Use dry, relatable dev humor. Start with "Nobody:" or "Current mood:". Ground the humor directly in the headline. End with link and #devlife.`,
		templates: [
			(item, tag) =>
				`Current mood in tech today:\n"${item.title}"\n\nRelatable content: ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`Nobody:\nLiterally nobody:\nThe timeline today:\n"${item.title}"\n\n👉 ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'The accuracy of this physically hurts.',
			'Too real for a weekday morning.',
			'Bookmarking this for the group chat.',
		],
	},

	bot_daily_giggle: {
		structureInstruction: `Use cheerful, wholesome daily observation style. Start with "☀️ Timeline Cleanser:". Reflect on quirky, fun news grounded in the headline. End with link and #wholesome.`,
		templates: [
			(item, tag) => {
				const excerpt = get_grounded_excerpt(item)
				return `☀️ Timeline Cleanser:\n"${item.title}"\n\n${excerpt ? `${excerpt}\n\n` : ''}Read story: ${item.link} ${tag}`.trim()
			},
			(item, tag) =>
				`✨ Lighthearted find today:\n"${item.title}"\n\nA welcome story on the feed today!\n\nLink: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'This genuinely made my whole morning brighter!',
			'Wholesome timeline cleanser right here.',
			'Love seeing stories like this.',
		],
	},

	bot_coffee_dial: {
		structureInstruction: `Use specialty coffee and cafe enthusiast tone. Start with "☕ Coffee Dispatch //". Ground observations strictly in the article title and summary without inventing unsupported tasting notes. End with link and #coffee.`,
		templates: [
			(item, tag) => {
				const excerpt = get_grounded_excerpt(item)
				return `☕ Coffee Dispatch //\n"${item.title}"\n\n${excerpt ? `${excerpt}\n\n` : ''}Coffee notes & story: ${item.link} ${tag}`.trim()
			},
			(item, tag) =>
				`🌱 Coffee & Cafe Culture Radar:\n"${item.title}"\n\nGreat read to pair with your morning brew.\n\nRead more: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Perfect read to pair with a morning cup.',
			'Always appreciate good coverage of coffee craft.',
			'Pour over brewed, time to dive into this.',
		],
	},

	bot_cafe_stranger: {
		structureInstruction: `Use cozy notebook and corner cafe vibes. Start with "🪟 Corner Cafe Notebook //". Ground reflections in the article title. End with link and #aesthetic.`,
		templates: [
			(item, tag) => {
				const excerpt = get_grounded_excerpt(item)
				return `🪟 Corner Cafe Notebook //\n"${item.title}"\n\n${excerpt ? `${excerpt}\n\n` : ''}Discover: ${item.link} ${tag}`.trim()
			},
			(item, tag) =>
				`🌧️ Quiet Afternoon Read:\n"${item.title}"\n\nFound a calm corner to catch up on this today.\n\nRead along: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Quiet afternoon + cafe window seat = unmatched peace.',
			'The aesthetic here is so dreamy.',
			'Saving this for a calm read later.',
		],
	},

	bot_macro_pulse: {
		structureInstruction: `Use institutional macroeconomic brief. Start with "📊 Macro Intelligence Briefing:". Summarize key signals directly grounded in the headline and source summary. End with link and #macro. Never fabricate numerical rates, yields, or metrics not present in the source.`,
		templates: [
			(item, tag) => {
				const excerpt = get_grounded_excerpt(item)
				return `📊 Macro Intelligence Briefing:\n"${item.title}"\n\n${excerpt ? `Key Takeaway: ${excerpt}\n\n` : ''}Institutional brief: ${item.link} ${tag}`.trim()
			},
			(item, tag) =>
				`🏛️ Global Macro Watch:\n"${item.title}"\n\nTracking the developments and structural market implications.\n\nData & analysis: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Tracking the broader market implications here.',
			'Very informative breakdown on this macro shift.',
			'Sobering macro analysis.',
		],
	},

	bot_curious_notes: {
		structureInstruction: `Use thoughtful inquiry and mental models. Start with "🧠 Learning Note for Today:". State a reflective question grounded in the headline. End with link and #mentalmodels.`,
		templates: [
			(item, tag) => {
				const excerpt = get_grounded_excerpt(item)
				return `🧠 Learning Note for Today:\n"${item.title}"\n\n${excerpt ? `${excerpt}\n\n` : ''}Deep dive: ${item.link} ${tag}`.trim()
			},
			(item, tag) =>
				`🔍 Deep Inquiry // Curiosity Radar:\n"${item.title}"\n\nReflecting on the underlying principles behind this development.\n\nNotes: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Such a thoughtful perspective to reflect on.',
			'Great mental model application.',
			'Challenging default assumptions is always worthwhile.',
		],
	},

	bot_indie_founder: {
		structureInstruction: `Use transparent bootstrapped indie hacker style. Start with "🚀 Build in Public // Founder Notes:". Frame comments around product iteration and execution grounded in the headline. End with link and #buildinpublic.`,
		templates: [
			(item, tag) => {
				const excerpt = get_grounded_excerpt(item)
				return `🚀 Build in Public // Founder Notes:\n"${item.title}"\n\n${excerpt ? `${excerpt}\n\n` : ''}Read breakdown: ${item.link} ${tag}`.trim()
			},
			(item, tag) =>
				`🛠️ Bootstrapping Playbook:\n"${item.title}"\n\nFocus on distribution, product craft, and steady execution.\n\nCheck it out: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Solid execution over vanity metrics any day.',
			'Ship fast, talk to customers, repeat.',
			'Bootstrapping efficiency at its finest.',
		],
	},

	bot_daily_facts: {
		structureInstruction: `Use "Did You Know?" curiosity dispatch style. Start with "🔬 Curiosity Dispatch:". Ground the discovery strictly in the provided headline and summary. End with link and #todayilearned.`,
		templates: [
			(item, tag) => {
				const excerpt = get_grounded_excerpt(item)
				return `🔬 Curiosity Dispatch:\n"${item.title}"\n\n${excerpt ? `${excerpt}\n\n` : ''}Explore: ${item.link} ${tag}`.trim()
			},
			(item, tag) =>
				`🌌 Science & Discovery Radar:\n"${item.title}"\n\nFascinating research worth taking a few minutes to explore today.\n\nRead discovery: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Fascinating discovery!',
			'Science never ceases to amaze me.',
			'TIL something truly interesting today.',
		],
	},
}

/**
 * Fallback style for custom bots or unmapped personas
 */
const default_persona_style: PersonaPostStyle = {
	structureInstruction: `Write an engaging, authentic social post. Lead with an intriguing hook or perspective, quote the headline, and provide the link naturally. Only reference facts provided in the headline and summary.`,
	templates: [
		(item, tag) => {
			const excerpt = get_grounded_excerpt(item)
			return `Really thoughtful perspective on this:\n\n"${item.title}"\n\n${excerpt ? `${excerpt}\n\n` : ''}Worth checking out:\n${item.link} ${tag}`.trim()
		},
		(item, tag) =>
			`"${item.title}"\n\nFascinating developments here. What's your take?\n\n${item.link} ${tag}`.trim(),
		(item) => `Solid breakdown worth bookmarking:\n\n"${item.title}"\n\n${item.link}`.trim(),
	],
	commentStyle: [
		'Super interesting takeaway, thanks for sharing this.',
		"Couldn't agree more with this perspective.",
		'Curious how this will look a year from now.',
	],
}

export function get_persona_style(persona: BotPersona): PersonaPostStyle {
	return PERSONA_POST_STYLES[persona.id] ?? default_persona_style
}

/**
 * Generate an authentic, uniquely structured social media post for a given news item.
 */
export async function generate_post_content(
	persona: BotPersona,
	item: FeedItem,
	env: LLMEnv,
): Promise<string> {
	const primary_tag = persona.hashtags[0] ?? ''
	const style = get_persona_style(persona)

	const prompt = `You are a real user on a social network (like Twitter/Bluesky).
Your persona name: ${persona.name} (@${persona.username})
Tone prompt: ${persona.tonePrompt}

YOUR SIGNATURE POST STRUCTURE:
${style.structureInstruction}

Here is a news item from a trusted source:
Headline: "${item.title}"
${item.description ? `Summary: "${item.description.slice(0, 200)}"` : ''}
Link: ${item.link}

Write a captivating social post (under 280 characters).
Strict formatting rules:
- Strictly adopt your SIGNATURE POST STRUCTURE described above.
- Sound human, authentic, and completely in-character.
- Include the exact link: ${item.link}
- Use your persona's distinctive layout, line-breaks, and emojis.
- Do NOT wrap your entire response in quotes.
- Do NOT fabricate claims, statistics, or specifics that are absent from the headline or summary.
- Do NOT use robotic generic phrases like "In a world where..." or "As an AI...".`

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
					temperature: 0.85,
					max_tokens: 180,
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
			console.warn('[Bot LLM] Post generation failed, falling back to persona template:', err)
		}
	}

	// Persona-specific fallback: select one of their distinct signature templates
	const templates = style.templates
	const chosen = templates[Math.floor(Math.random() * templates.length)]
	const fallback_post = chosen(item, primary_tag)

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
	const style = get_persona_style(persona)

	const prompt = `You are replying to a post on a social media app.
Your persona: ${persona.name} (@${persona.username})
Tone: ${persona.tonePrompt}

Target post:
"${target_post_content.slice(0, 200)}"

Write a short, natural reaction comment (1-2 sentences, under 120 characters).
Sound like a real person casually replying. Do not be overly promotional. Do not use hashtags.`

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
					temperature: 0.9,
					max_tokens: 60,
				}),
			})

			if (res.ok) {
				const data = (await res.json()) as {
					choices?: [{ message?: { content?: string } }]
				}
				const generated = data.choices?.[0]?.message?.content?.trim()
				if (generated) {
					const clean = generated
						.replace(/^["']|["']$/g, '')
						.replace(/#\w+/g, '')
						.trim()
					if (clean.length > 0 && clean.length <= 140) {
						return clean
					}
				}
			}
		} catch (err) {
			console.warn('[Bot LLM] Comment generation failed, falling back to static comments:', err)
		}
	}

	// Persona-specific fallback: select one of their distinct comment styles
	const comments = style.commentStyle
	return comments[Math.floor(Math.random() * comments.length)]
}
