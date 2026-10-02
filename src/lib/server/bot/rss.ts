export interface FeedItem {
	title: string
	link: string
	description?: string
	publishedAt?: string
}

function decode_html_entities(text: string): string {
	return text
		.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'")
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

			if (title && link) {
				items.push({
					title,
					link,
					description: description || undefined,
					publishedAt: date_match ? date_match[1].trim() : undefined,
				})
			}
		}

		if (items.length > 0) return items

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
			const description = summary_match ? decode_html_entities(summary_match[1]).slice(0, 300) : ''

			if (title && link) {
				items.push({
					title,
					link,
					description: description || undefined,
					publishedAt: date_match ? date_match[1].trim() : undefined,
				})
			}
		}

		return items
	} catch (err) {
		console.error(`[RSS] Error reading feed ${feed_url}:`, err)
		return []
	}
}
