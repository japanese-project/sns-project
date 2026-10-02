import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { BANNER_THEMES } from '$lib/banner-themes'
import { MAX_POST_LENGTH } from '$lib/limits'
import type { Db } from '../db'
import { post as post_table, user as user_table } from '../db/schema'
import { create_test_db } from '../services/test-db'
import { BOT_PERSONAS } from './personas'
import { generate_post_content } from './llm'
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
})

describe('Bot LLM / template formatter', () => {
	it('generates content conforming to MAX_POST_LENGTH with fallback', async () => {
		const persona = BOT_PERSONAS[0]
		const item = {
			title: 'A very cool tech framework released today',
			link: 'https://example.com/cool-tech',
			description: 'This framework changes how we develop frontend applications.',
		}

		const content = await generate_post_content(persona, item, {})
		expect(content.length).toBeLessThanOrEqual(MAX_POST_LENGTH)
		expect(content).toContain(item.title)
		expect(content).toContain(item.link)
		expect(content).toContain(persona.hashtags[0])
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
})
