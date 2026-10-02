export interface FeedItem {
	title: string
	link: string
	description?: string
	publishedAt?: string
	published_timestamp?: number
}

// 48 hours freshness window to ensure bots only post breaking, up-to-date news
const max_news_age_ms = 48 * 60 * 60 * 1000

export interface TrustedSourcePreset {
	category: string
	name: string
	domain: string
	url: string
}

export const TRUSTED_FEED_PRESETS: TrustedSourcePreset[] = [
	{
		category: 'AI & Tech',
		name: 'The Verge',
		domain: 'theverge.com',
		url: 'https://www.theverge.com/rss/index.xml',
	},
	{
		category: 'AI & Tech',
		name: 'TechCrunch',
		domain: 'techcrunch.com',
		url: 'https://techcrunch.com/feed/',
	},
	{
		category: 'AI & Tech',
		name: 'Ars Technica',
		domain: 'arstechnica.com',
		url: 'https://feeds.arstechnica.com/arstechnica/index',
	},
	{
		category: 'AI & Tech',
		name: 'Simon Willison AI Notes',
		domain: 'simonwillison.net',
		url: 'https://simonwillison.net/atom/everything/',
	},
	{
		category: 'AI & Tech',
		name: 'Dev.to Community',
		domain: 'dev.to',
		url: 'https://dev.to/feed',
	},
	{
		category: 'AI & Tech',
		name: 'Hacker News',
		domain: 'news.ycombinator.com',
		url: 'https://news.ycombinator.com/rss',
	},
	{
		category: 'Anime & Manga',
		name: 'Anime News Network',
		domain: 'animenewsnetwork.com',
		url: 'https://www.animenewsnetwork.com/all/rss.xml?ann-edition=us',
	},
	{
		category: 'Anime & Manga',
		name: 'Anime Corner',
		domain: 'animecorner.me',
		url: 'https://animecorner.me/feed/',
	},
	{
		category: 'Movies & TV',
		name: 'Collider',
		domain: 'collider.com',
		url: 'https://collider.com/feed/',
	},
	{
		category: 'Movies & TV',
		name: 'Screen Rant',
		domain: 'screenrant.com',
		url: 'https://screenrant.com/feed/',
	},
	{
		category: 'Economics & Markets',
		name: 'CNBC Business',
		domain: 'cnbc.com',
		url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664',
	},
	{
		category: 'Economics & Markets',
		name: 'CoinDesk Macro',
		domain: 'coindesk.com',
		url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
	},
	{
		category: 'Science & Ideas',
		name: 'ScienceDaily',
		domain: 'sciencedaily.com',
		url: 'https://www.sciencedaily.com/rss/top/science.xml',
	},
	{
		category: 'Coffee & Cafe',
		name: 'Sprudge Coffee Mag',
		domain: 'sprudge.com',
		url: 'https://sprudge.com/feed',
	},
]

function decode_html_entities(text: string): string {
	return text
		.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
		.replace(/&amp;/g, '&')
		.replace(/&#38;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#34;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'")
		.replace(/&rsquo;/g, "'")
		.replace(/&lsquo;/g, "'")
		.replace(/&rdquo;/g, '"')
		.replace(/&ldquo;/g, '"')
		.replace(/&mdash;/g, '—')
		.replace(/&ndash;/g, '–')
		.replace(/&hellip;/g, '…')
		.replace(/&#x2F;/g, '/')
		.replace(/&nbsp;/g, ' ')
		.replace(/<[^>]+>/g, ' ') // Strip remaining HTML tags
		.replace(/\s+/g, ' ')
		.trim()
}

export async function fetch_feed_items(feed_url: string): Promise<FeedItem[]> {
	try {
		const res = await fetch(feed_url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SNSFeedBot/1.0',
				Accept: 'application/rss+xml, application/atom+xml, text/xml, */*',
			},
			redirect: 'follow',
		})

		if (!res.ok) {
			console.warn(`[RSS] Failed to fetch feed ${feed_url}: ${res.status}`)
			return []
		}

		const xml = await res.text()
		const items: FeedItem[] = []

		// 1. Try RSS 2.0 <item> matches
		const item_regex = /<item[\s>]([\s\S]*?)<\/item>/gi
		let match: RegExpExecArray | null

		while ((match = item_regex.exec(xml)) !== null) {
			const item_body = match[1]

			const title_match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(item_body)
			const link_match = /<link[^>]*>([\s\S]*?)<\/link>/i.exec(item_body)
			const desc_match =
				/<description[^>]*>([\s\S]*?)<\/description>/i.exec(item_body) ??
				/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i.exec(item_body)
			const date_match = /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i.exec(item_body)

			const title = title_match ? decode_html_entities(title_match[1]) : ''
			const link = link_match ? link_match[1].trim() : ''
			const description = desc_match ? decode_html_entities(desc_match[1]).slice(0, 300) : ''
			const raw_date = date_match ? date_match[1].trim() : undefined
			const parsed_time = raw_date ? Date.parse(raw_date) : NaN
			const published_timestamp = Number.isNaN(parsed_time) ? undefined : parsed_time

			if (title && link) {
				items.push({
					title,
					link,
					description: description || undefined,
					publishedAt: raw_date,
					published_timestamp,
				})
			}
		}

		if (items.length === 0) {
			// 2. Try Atom <entry> matches
			const entry_regex = /<entry[\s>]([\s\S]*?)<\/entry>/gi
			while ((match = entry_regex.exec(xml)) !== null) {
				const entry_body = match[1]

				const title_match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(entry_body)
				// In Atom, <link href="..." /> or <link>...</link>
				let link = ''
				const link_attr_match = /<link[^>]+href=["']([^"']+)["']/i.exec(entry_body)
				if (link_attr_match) {
					link = link_attr_match[1].trim()
				} else {
					const link_tag_match = /<link[^>]*>([\s\S]*?)<\/link>/i.exec(entry_body)
					if (link_tag_match) link = link_tag_match[1].trim()
				}

				const summary_match =
					/<summary[^>]*>([\s\S]*?)<\/summary>/i.exec(entry_body) ??
					/<content[^>]*>([\s\S]*?)<\/content>/i.exec(entry_body)
				const date_match =
					/<updated[^>]*>([\s\S]*?)<\/updated>/i.exec(entry_body) ??
					/<published[^>]*>([\s\S]*?)<\/published>/i.exec(entry_body)

				const title = title_match ? decode_html_entities(title_match[1]) : ''
				const description = summary_match
					? decode_html_entities(summary_match[1]).slice(0, 300)
					: ''
				const raw_date = date_match ? date_match[1].trim() : undefined
				const parsed_time = raw_date ? Date.parse(raw_date) : NaN
				const published_timestamp = Number.isNaN(parsed_time) ? undefined : parsed_time

				if (title && link) {
					items.push({
						title,
						link,
						description: description || undefined,
						publishedAt: raw_date,
						published_timestamp,
					})
				}
			}
		}

		// Sort by published date descending (newest first)
		items.sort((a, b) => (b.published_timestamp ?? 0) - (a.published_timestamp ?? 0))

		// Filter for fresh news within the last 48 hours if timestamps are present
		const now = Date.now()
		const fresh_items = items.filter(
			(item) => !item.published_timestamp || now - item.published_timestamp <= max_news_age_ms,
		)

		return fresh_items.length > 0 ? fresh_items : items.slice(0, 10)
	} catch (err) {
		console.error(`[RSS] Error reading feed ${feed_url}:`, err)
		return []
	}
}
