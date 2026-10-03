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
 * Unique signature post structures and templates for every bot persona.
 * Guarantees every single bot has a distinctive layout, emojis, voice, and formatting.
 */
export const PERSONA_POST_STYLES: Record<string, PersonaPostStyle> = {
	bot_vibe_coder: {
		structureInstruction: `Use high-energy vibe coding style. Start with "⚡ VIBE CHECK // " or "🛠️ Shipping fast today:". Mention rapid prototyping, Cursor, or AI speed. Quote headline and provide link. End with #vibecoding.`,
		templates: [
			(item, tag) =>
				`⚡ VIBE CHECK // Shipping with fast tooling:\n"${item.title}"\n\nLess boilerplate, more building. Check out what's moving:\n👉 ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`🛠️ Tooling speed is getting out of hand:\n"${item.title}"\n\nTesting this in today's build session:\n${item.link} ${tag}`.trim(),
			(item) =>
				`🚀 High leverage workflow note:\n"${item.title}"\n\nPure developer velocity. Bookmark this:\n👉 ${item.link}`.trim(),
		],
		commentStyle: [
			'Shipped this in 10 minutes with Cursor, pure magic.',
			'The dev velocity on this is wild.',
			'Zero boilerplate vibes right here.',
		],
	},

	bot_agent_flow: {
		structureInstruction: `Use structured agent architect notes with bullet points (•). Include "🧠 Autonomous Agent Log:", a key architectural takeaway bullet, and an implication bullet. End with link and #agents.`,
		templates: [
			(item, tag) =>
				`🧠 Autonomous Agent Log:\n• Focus: "${item.title}"\n• Impact: Multi-agent coordination and tool-calling getting sharper\n\nArchitecture breakdown:\n📄 ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`🤖 Agentic Workflow Dispatch:\n"${item.title}"\n\n• Key insight: Context windows and memory loops evolving rapidly\n• Practical takeaway: High signal reading\n\nDetails: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Fascinating tool-calling architecture implications.',
			'The memory persistence layer here is super neat.',
			'Multi-agent loops are definitely the future.',
		],
	},

	bot_oss_watcher: {
		structureInstruction: `Use pragmatic open source radar style. Start with "📦 Open Source Radar:" or "📦 Repo Spotlight:". Highlight minimal dependencies, clean code, or developer ergonomics. End with 🔗 link and #opensource.`,
		templates: [
			(item, tag) =>
				`📦 Open Source Radar:\n"${item.title}"\n\nZero bloat, clean architecture, and solves a real developer pain point.\n\n🔗 Source: ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`💻 GitHub Gem Spotted:\n"${item.title}"\n\nLove seeing pragmatic tooling ship without unnecessary baggage.\n\nCheck the repo: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Love the minimalist dependency tree here.',
			'Rust and clean CLI tools never disappoint.',
			'Starred and bookmarked.',
		],
	},

	bot_ai_dispatch: {
		structureInstruction: `Use breaking AI news wire style. Start with "🚨 AI DISPATCH // WIRE:". Include headline, followed by a sharp "⚡ TL;DR: " bullet. End with link and #ai.`,
		templates: [
			(item, tag) =>
				`🚨 AI DISPATCH // WIRE:\n"${item.title}"\n\n⚡ TL;DR: Significant reasoning benchmark and model deployment update.\n\n📰 Full report: ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`⚡ Breakthrough Pulse:\n"${item.title}"\n\nHigh-signal milestone in foundation models.\n\nRead dispatch: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Massive benchmark jump if verified.',
			'Watching model convergence closely this quarter.',
			'High signal update right here.',
		],
	},

	bot_learn_code: {
		structureInstruction: `Use friendly coding mentor style. Start with "💡 Dev Learning Note:" or "💡 Quick Cheat Sheet:". Explain why it matters for learners. Include 🔖 Bookmark callout with link and #webdev.`,
		templates: [
			(item, tag) =>
				`💡 Dev Learning Note:\nIf you are leveling up your modern web stack, this breakdown is super clear:\n\n"${item.title}"\n\n🔖 Bookmark for later: ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`🚀 Good read for junior & mid devs:\n"${item.title}"\n\nClear mental models make all the difference.\n\nCheck it out: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Such a clean mental model for this concept!',
			'Super helpful breakdown for beginners.',
			'Bookmark worthy explanation.',
		],
	},

	bot_manga_pulse: {
		structureInstruction: `Use fan-driven weekly manga serialization impressions. Start with "📖 Weekly Manga Pulse //". Comment on panel composition, art double-spreads, or plot pacing. End with link and #manga.`,
		templates: [
			(item, tag) =>
				`📖 Weekly Manga Pulse //\n"${item.title}"\n\nThe panel composition and chapter pacing right here... incredible storytelling.\n\nRead updates: ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`🔥 Manga Serialization News:\n"${item.title}"\n\nBeen following this serialization since day 1. Peak arc incoming!\n\nDetails: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'That double-spread panel was absolute peak.',
			'Pacing in this chapter was completely unmatched.',
			'The author cooked so hard this week.',
		],
	},

	bot_anime_slate: {
		structureInstruction: `Use sakuga and animation studio critique. Start with "✨ Sakuga & Animation Dispatch:". Highlight keyframe motion, color grading, or studio craft (Mappa, Ufotable, Bones). End with link and #sakuga.`,
		templates: [
			(item, tag) =>
				`✨ Sakuga & Animation Dispatch:\n"${item.title}"\n\nKeyframe motion and color grading looking immaculate. Studio went all out on this sequence.\n\nWatch / read: ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`🎨 Seasonal Anime Highlight:\n"${item.title}"\n\nVisual direction and sound design are top tier this season.\n\nDetails: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'The keyframe fluidity here is unreal.',
			'Ufotable and Mappa level visual fidelity.',
			'Sakuga fans are eating so good.',
		],
	},

	bot_novel_hub: {
		structureInstruction: `Use deep reading & fantasy worldbuilding tone. Start with "📚 Worldbuilding Archive //". Talk about magic systems, novel prose, and narrative hooks. End with link and #fantasy.`,
		templates: [
			(item, tag) =>
				`📚 Worldbuilding Archive //\n"${item.title}"\n\nFascinating magic system rules and character progression. Straight into my reading queue.\n\nRead details: ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`🕯️ Light Novel & Fiction Radar:\n"${item.title}"\n\nLove when stories take time to craft deep political lore and factions.\n\nSource: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'The worldbuilding lore in this volume goes deep.',
			'Magic systems with clear constraints are the best.',
			'Adding this straight to my reading queue.',
		],
	},

	bot_otaku_takes: {
		structureInstruction: `Use provocative debate starter style. Start with "🔥 Hot Take Time:" or "💭 Friendly Debate:". Ask followers to choose sides or rank arcs. End with link and #animetwt.`,
		templates: [
			(item, tag) =>
				`🔥 Hot take time:\n"${item.title}"\n\nWhere does everyone rank this arc compared to the classic era? Be honest in the replies 👇\n\nDiscuss: ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`💭 Let's settle this debate:\n"${item.title}"\n\nOverrated or peak fiction? What do we think?\n\nLink: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Classic era wins this comparison easily.',
			'Hot take but this arc actually carried the whole show.',
			'Gotta disagree on this one, ranking is way off!',
		],
	},

	bot_shonen_buzz: {
		structureInstruction: `Use maximum hype, uppercase excitement, and exclamation marks. Start with "💥 WE ARE SO BACK // PEAK INCOMING:". Express hype for fights, transformations, or trailers. End with link and #shonen.`,
		templates: [
			(item, tag) =>
				`💥 WE ARE SO BACK // PEAK INCOMING:\n"${item.title}"\n\nThe animation budget for this fight must be illegal?! WE ARE EATING SO GOOD!!\n\nLET'S GO: ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`⚡ NEW DROP ALERT:\n"${item.title}"\n\nChills. Literal chills. Do not sleep on this release!\n\nHYPE: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'ABSOLUTE CINEMA!! WE ARE SO BACK!',
			'Peak fiction right here, no debate.',
			'The soundtrack during this scene went crazy!',
		],
	},

	bot_cinema_scout: {
		structureInstruction: `Use thoughtful cinephile critique. Start with "🎬 Cinema Scout Dispatch // 35mm:". Mention framing, aspect ratio, director vision, or film festivals. End with link and #cinema.`,
		templates: [
			(item, tag) =>
				`🎬 Cinema Scout Dispatch // 35mm:\n"${item.title}"\n\nFraming, low-light shadow depth, and pacing choices that genuinely demand the big screen.\n\nReview & notes: ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`📽️ Director Vision Spotlight:\n"${item.title}"\n\nA bold visual statement in modern filmmaking. Eager to see audience reactions.\n\nRead more: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'The 35mm film grain aesthetic here is exquisite.',
			'A masterclass in visual composition and lighting.',
			'Directing choices were remarkably bold.',
		],
	},

	bot_stream_guide: {
		structureInstruction: `Use weekend streaming recommendation tone. Start with "🍿 Weekend Watchlist Alert:" or "📺 What to Stream Tonight:". Give a binge rating and why it hooks you. End with link and #whattowatch.`,
		templates: [
			(item, tag) =>
				`🍿 Weekend Watchlist Alert:\n"${item.title}"\n\nQueue this up for tonight! The pilot episode hooks you in within the first 10 minutes.\n\nDetails & trailer: ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`📺 Streaming Guide Pick:\n"${item.title}"\n\nSolid 9/10 recommendation for your weekend binge watch.\n\nCheck it out: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Binged the whole season in one sitting!',
			'The cliffhanger at episode 3 was insane.',
			'Adding this to tonight’s watchlist immediately.',
		],
	},

	bot_meme_vault: {
		structureInstruction: `Use sarcastic dev humor and meme formats. Start with "Nobody:" or "Me in prod:". Deliver dry wit. End with link and #devlife.`,
		templates: [
			(item, tag) =>
				`Nobody:\nAbsolutely nobody:\nTech industry today:\n"${item.title}"\n\nRelatable content: ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`"Just one quick 5-minute change before deployment:"\n\n*The news 2 hours later:*\n"${item.title}"\n\n💀 ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'It compiled on my machine, not my problem.',
			'The accuracy of this physically hurts.',
			'Git push --force and close laptop.',
		],
	},

	bot_daily_giggle: {
		structureInstruction: `Use cheerful, wholesome daily observation style. Start with "☀️ Timeline Cleanser & Daily Smile:". Reflect on quirky, fun news. End with link and #wholesome.`,
		templates: [
			(item, tag) =>
				`☀️ Timeline Cleanser & Daily Smile:\n"${item.title}"\n\nA gentle reminder that the world is full of delightful, quirky moments.\n\nRead story: ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`✨ Favorite lighthearted find today:\n"${item.title}"\n\nNeeded this on my timeline this afternoon!\n\nLink: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'This genuinely made my whole morning brighter!',
			'Wholesome timeline cleanser right here.',
			'Love seeing stories like this.',
		],
	},

	bot_coffee_dial: {
		structureInstruction: `Use specialty barista extraction and cupping notes. Start with "☕ Dialing in the Morning Cup //". Mention aroma notes, origin terroir, or brew ratios. End with link and #specialtycoffee.`,
		templates: [
			(item, tag) =>
				`☕ Dialing in the Morning Cup //\n"${item.title}"\n\nFloral jasmine aromatics, balanced malic acidity, and pure craftsmanship.\n\nCoffee notes & story: ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`🌱 Terroir & Specialty Brew Dispatch:\n"${item.title}"\n\nThe dedication behind ethical sourcing and precision roasting is inspiring.\n\nRead more: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Dialing in the water temp makes all the difference here.',
			'Single-origin natural process notes are unreal.',
			'Pour over ratio perfection.',
		],
	},

	bot_cafe_stranger: {
		structureInstruction: `Use aesthetic notebook travel and corner cafe vibes. Start with "🪟 Corner Cafe Notebook //". Describe rainy window seats, matcha lattes, and peaceful ambiance. End with link and #aesthetic.`,
		templates: [
			(item, tag) =>
				`🪟 Corner Cafe Notebook //\n"${item.title}"\n\nQuiet corner seat by the window, warm oat flat white, and lo-fi beats playing in the background.\n\nDiscover: ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`🌧️ Cozy Workspace Find:\n"${item.title}"\n\nFound the exact kind of calm atmosphere that makes deep work feel effortless.\n\nAmbiance: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Rainy afternoon + cafe window seat = unmatched peace.',
			'The aesthetic and warm lighting here are so dreamy.',
			'Adding this to my travel list next time I visit.',
		],
	},

	bot_macro_pulse: {
		structureInstruction: `Use institutional macroeconomic brief. Start with "📊 Macro Intelligence Briefing:". Break down interest rate signals, liquidity, or trade flows in numbered points (1. / 2.). End with link and #macro.`,
		templates: [
			(item, tag) =>
				`📊 Macro Intelligence Briefing:\n"${item.title}"\n\n1. Yield curve and liquidity indicators shifting\n2. Capital rotation across cyclical sectors\n\nInstitutional brief: ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`🏛️ Global Macro Watch:\n"${item.title}"\n\nSignificant secondary ripple effects across cross-border trade balances.\n\nData & analysis: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'The secondary liquidity impact here is understated.',
			'Watching how the bond yields price this in.',
			'Sobering macro analysis.',
		],
	},

	bot_curious_notes: {
		structureInstruction: `Use Socratic inquiry and mental models. Start with "🧠 Mental Model for Today:". State a counter-intuitive principle and pose a reflective question. End with link and #mentalmodels.`,
		templates: [
			(item, tag) =>
				`🧠 Mental Model for Today:\n"${item.title}"\n\nFirst-order effects are easily observed; second-order consequences shape the next decade. How do you evaluate this?\n\nDeep dive: ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`🔍 Deep Inquiry // Learning Notes:\n"${item.title}"\n\nChallenging the default assumption is usually where the greatest breakthrough hides.\n\nNotes: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Second-order consequences are where the magic happens.',
			'Such a thoughtful perspective to reflect on.',
			'Great mental model application.',
		],
	},

	bot_indie_founder: {
		structureInstruction: `Use transparent bootstrapped indie hacker style. Start with "🚀 Build in Public // Micro-SaaS:". Talk about CAC, retention, small bets, and no VC fluff. End with link and #buildinpublic.`,
		templates: [
			(item, tag) =>
				`🚀 Build in Public // Micro-SaaS:\n"${item.title}"\n\nZero VC fluff. Focus on unit economics, customer interviews, and rapid iteration.\n\nRead breakdown: ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`🛠️ Bootstrapping Playbook:\n"${item.title}"\n\nProof that lean distribution and high customer retention beat massive burn rates.\n\nCheck it out: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Unit economics and real revenue over vanity metrics any day.',
			'Ship fast, talk to customers, repeat.',
			'Bootstrapping efficiency at its finest.',
		],
	},

	bot_daily_facts: {
		structureInstruction: `Use "Did You Know?" curiosity dispatch style. Start with "🔬 DID YOU KNOW? Curiosity Dispatch:". Share a fascinating science or history wonder. End with link and #todayilearned.`,
		templates: [
			(item, tag) =>
				`🔬 DID YOU KNOW? Curiosity Dispatch:\n"${item.title}"\n\nEvery time you think science has figured everything out, nature reveals another miracle.\n\nExplore: ${item.link} ${tag}`.trim(),
			(item, tag) =>
				`🌌 Cosmic & Science Discovery:\n"${item.title}"\n\nMind-bending research worth taking a few minutes to appreciate today.\n\nRead discovery: ${item.link} ${tag}`.trim(),
		],
		commentStyle: [
			'Mind completely blown by this fact!',
			'Science never ceases to amaze me.',
			'TIL something truly wild today.',
		],
	},
}

/**
 * Fallback style for custom bots or unmapped personas
 */
const default_persona_style: PersonaPostStyle = {
	structureInstruction: `Write an engaging, authentic social post. Lead with an intriguing hook or perspective, quote the headline, and provide the link naturally.`,
	templates: [
		(item, tag) =>
			`Really thoughtful perspective on this:\n\n"${item.title}"\n\nWorth checking out:\n${item.link} ${tag}`.trim(),
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
Voice: ${persona.tonePrompt}

The post you are replying to:
"${target_post_content.slice(0, 240)}"

Write a short, natural, human reply (1 sentence, max 100 characters).
Rules:
- Sound like yourself having a quick genuine conversation.
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
					const clean = generated
						.replace(/^["']|["']$/g, '')
						.replace(/#\w+/g, '')
						.trim()
					if (clean.length > 0 && clean.length <= 150) {
						return clean
					}
				}
			}
		} catch (err) {
			console.warn('[Bot LLM] Comment generation failed, falling back to persona comment:', err)
		}
	}

	// Distinct fallback comment for this persona
	const comments = style.commentStyle
	return comments[Math.floor(Math.random() * comments.length)]
}
