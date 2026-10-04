import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { BANNER_THEMES } from '$lib/banner-themes'
import { MAX_POST_LENGTH } from '$lib/limits'
import type { Db } from '../db'
import { comment as comment_table, post as post_table, user as user_table } from '../db/schema'
import { create_test_db } from '../services/test-db'
import { BOT_PERSONAS } from './personas'
import { generate_post_content, generate_bot_comment } from './llm'
import {
	cancel_bot_campaign,
	delete_custom_persona,
	get_all_active_personas,
	get_bot_config,
	save_bot_config,
	save_custom_persona,
	save_persona_override,
} from './config'
import { run_bot_cycle } from './runner'
import * as rssModule from './rss'

describe('Bot personas configuration', () => {
	it('has 20 unique bot personas', () => {
		expect(BOT_PERSONAS.length).toBe(20)

		const ids = new Set(BOT_PERSONAS.map((b) => b.id))
		expect(ids.size).toBe(20)

		const usernames = new Set(BOT_PERSONAS.map((b) => b.username))
		expect(usernames.size).toBe(20)
	})

	it('uses valid banner themes for every persona', () => {
		const valid_theme_ids = new Set(BANNER_THEMES.map((t) => t.id))
		for (const bot of BOT_PERSONAS) {
			expect(valid_theme_ids.has(bot.bannerColor)).toBe(true)
		}
	})

	it('has at least one feed and relevant hashtags for every persona', () => {
		for (const bot of BOT_PERSONAS) {
			expect(bot.feeds.length).toBeGreaterThan(0)
			expect(bot.hashtags.length).toBeGreaterThan(0)
			expect(bot.tonePrompt.length).toBeGreaterThan(20)
		}
	})

	it('provides a curated list of trusted source presets', () => {
		expect(rssModule.TRUSTED_FEED_PRESETS.length).toBeGreaterThan(10)
		for (const preset of rssModule.TRUSTED_FEED_PRESETS) {
			expect(preset.url).toMatch(/^https?:\/\//)
			expect(preset.name.length).toBeGreaterThan(2)
			expect(preset.domain.length).toBeGreaterThan(3)
		}
	})
})

describe('Bot Config and Campaign Management', () => {
	it('can set and cancel a campaign schedule', async () => {
		await save_bot_config({ campaign_end: new Date(Date.now() + 86400000).toISOString() })
		let config = await get_bot_config()
		expect(config.campaign_end).not.toBeNull()

		// Cancel schedule
		await cancel_bot_campaign()
		config = await get_bot_config()
		expect(config.campaign_end).toBeNull()
	})

	it('supports custom personas and persona overrides', async () => {
		const custom_bot = {
			id: 'bot_custom_tester',
			name: 'Test Bot',
			username: 'custom_tester',
			email: 'tester@bot.sns.internal',
			bio: 'A test custom bot',
			interests: ['testing'],
			bannerColor: 'emerald',
			image: 'https://example.com/avatar.png',
			topics: ['testing'],
			tonePrompt: 'You are a test bot.',
			feeds: ['https://example.com/feed'],
			hashtags: ['#test'],
		}

		await save_custom_persona(custom_bot)
		let personas = await get_all_active_personas()
		expect(personas.some((p) => p.id === 'bot_custom_tester')).toBe(true)

		// Override
		await save_persona_override('bot_custom_tester', { name: 'Renamed Bot' })
		personas = await get_all_active_personas()
		const found = personas.find((p) => p.id === 'bot_custom_tester')
		expect(found?.name).toBe('Renamed Bot')

		// Delete
		await delete_custom_persona('bot_custom_tester')
		personas = await get_all_active_personas()
		expect(personas.some((p) => p.id === 'bot_custom_tester')).toBe(false)
	})
})

describe('Bot LLM / template formatter & Comment Generator', () => {
	it('generates content conforming to MAX_POST_LENGTH with fallback', async () => {
		const persona = BOT_PERSONAS[0]
		const item = {
			title: 'A very cool tech framework released today',
			link: 'https://example.com/cool-tech',
			description: 'This framework changes how we develop frontend applications.',
		}

		// Verify fallback template without API keys
		const content = await generate_post_content(persona, item, {})
		expect(content.length).toBeLessThanOrEqual(MAX_POST_LENGTH)
		expect(content).toContain(item.link)
	})

	it('produces unique signature post structures for distinct personas', async () => {
		const item = {
			title: 'Major Breakthrough in Autonomous Web Development',
			link: 'https://example.com/breakthrough',
			description: 'New framework announced.',
		}

		const vibe_coder = BOT_PERSONAS.find((b) => b.id === 'bot_vibe_coder')!
		const agent_flow = BOT_PERSONAS.find((b) => b.id === 'bot_agent_flow')!
		const oss_watcher = BOT_PERSONAS.find((b) => b.id === 'bot_oss_watcher')!
		const coffee_dial = BOT_PERSONAS.find((b) => b.id === 'bot_coffee_dial')!
		const macro_pulse = BOT_PERSONAS.find((b) => b.id === 'bot_macro_pulse')!

		const post1 = await generate_post_content(vibe_coder, item, {})
		const post2 = await generate_post_content(agent_flow, item, {})
		const post3 = await generate_post_content(oss_watcher, item, {})
		const post4 = await generate_post_content(coffee_dial, item, {})
		const post5 = await generate_post_content(macro_pulse, item, {})

		// Check that each post is unique and not identical
		const set = new Set([post1, post2, post3, post4, post5])
		expect(set.size).toBe(5)

		// Check signature elements
		expect(post1).toMatch(/VIBE CHECK|Tooling|workflow/)
		expect(post2).toMatch(/Autonomous Agent Log|Agentic Workflow/)
		expect(post3).toMatch(/Open Source|Gem/)
		expect(post4).toMatch(/Coffee Dispatch|Coffee & Cafe/)
		expect(post5).toMatch(/Macro Intelligence|Global Macro/)
	})

	it('generates LLM post when API key is provided and fetch succeeds (mocked)', async () => {
		const persona = BOT_PERSONAS[0]
		const item = {
			title: 'Modern Web Performance Techniques',
			link: 'https://example.com/web-perf',
			description: 'An in-depth guide to modern web performance optimization.',
		}

		const mock_response = {
			ok: true,
			json: async () => ({
				choices: [
					{
						message: {
							content: `⚡ VIBE CHECK // Shipping fast:\n"Modern Web Performance Techniques"\n\nhttps://example.com/web-perf #vibecoding`,
						},
					},
				],
			}),
		}

		const original_fetch = globalThis.fetch
		const fetch_spy = vi.fn().mockResolvedValue(mock_response)
		globalThis.fetch = fetch_spy as unknown as typeof fetch

		try {
			const content = await generate_post_content(persona, item, { GROQ_API_KEY: 'test-key' })
			expect(fetch_spy).toHaveBeenCalledTimes(1)
			expect(content).toContain('https://example.com/web-perf')
			expect(content).toContain('VIBE CHECK')
		} finally {
			globalThis.fetch = original_fetch
		}
	})

	it('falls back gracefully to persona template when LLM fetch throws an error', async () => {
		const persona = BOT_PERSONAS[0]
		const item = {
			title: 'Failsafe Test Item',
			link: 'https://example.com/failsafe',
			description: 'Description for fallback checking.',
		}

		const original_fetch = globalThis.fetch
		globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error or rate limited'))

		try {
			const content = await generate_post_content(persona, item, { GROQ_API_KEY: 'test-key' })
			expect(content).toContain('https://example.com/failsafe')
			expect(content.length).toBeLessThanOrEqual(MAX_POST_LENGTH)
		} finally {
			globalThis.fetch = original_fetch
		}
	})

	it('generates natural short comments reacting to posts', async () => {
		const persona = BOT_PERSONAS[0]
		const post_text =
			'Check out this new TypeScript compiler rewrite in Rust! https://example.com/ts-rust'

		const comment = await generate_bot_comment(persona, post_text, {})
		expect(comment.length).toBeGreaterThan(5)
		expect(comment.length).toBeLessThan(140)
		expect(comment).not.toContain('#')
	})
})

describe('Bot Runner integration', () => {
	let db: Db
	let dispose: () => Promise<void>

	beforeAll(async () => {
		;({ db, dispose } = await create_test_db())

		// Seed the bot personas into test DB
		for (const bot of BOT_PERSONAS) {
			await db.insert(user_table).values({
				id: bot.id,
				name: bot.name,
				username: bot.username,
				email: bot.email,
				emailVerified: true,
				image: bot.image,
				bio: bot.bio,
				interests: JSON.stringify(bot.interests),
				bannerColor: bot.bannerColor,
				onboarded: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
		}
	})

	afterAll(async () => {
		await dispose()
	})

	it('picks a bot and successfully creates a post from a feed item', async () => {
		// Mock fetch_feed_items to return a deterministic test item
		vi.spyOn(rssModule, 'fetch_feed_items').mockResolvedValue([
			{
				title: 'Vitest 4.0 Released',
				link: 'https://example.com/vitest-4',
				description: 'Next gen testing framework improvements',
			},
		])

		const result = await run_bot_cycle(db, {})
		expect(result.success).toBe(true)
		expect(result.posted).toBeDefined()
		expect(result.posted?.title).toBe('Vitest 4.0 Released')

		// Verify the post was inserted in the database
		const posts_in_db = await db.select().from(post_table)
		expect(posts_in_db.length).toBe(1)
		expect(posts_in_db[0].userId.startsWith('bot_')).toBe(true)
	})

	it('skips duplicate links that have already been posted', async () => {
		// Next cycle with same item should find no unposted items
		const result = await run_bot_cycle(db, {})
		expect(result.success).toBe(true)
		expect(result.posted).toBeUndefined()
		expect(result.message).toContain('No new unposted items')
	})

	it('supports cross-bot commenting when new posts are published', async () => {
		// Add another fresh item
		vi.spyOn(rssModule, 'fetch_feed_items').mockResolvedValue([
			{
				title: 'New Web Standards Proposal',
				link: 'https://example.com/web-standards-2026',
				description: 'Modern specs for edge networking',
			},
		])

		// Force Math.random to trigger comments
		const orig_random = Math.random
		Math.random = () => 0.1 // triggers > 0.6 and > 0.3 checks

		try {
			const result = await run_bot_cycle(db, {}, { bypass_limits: true })
			expect(result.success).toBe(true)
			expect(result.posted).toBeDefined()

			const comments_in_db = await db.select().from(comment_table)
			expect(comments_in_db.length).toBeGreaterThan(0)
			expect(comments_in_db[0].userId.startsWith('bot_')).toBe(true)
		} finally {
			Math.random = orig_random
		}
	})
})
