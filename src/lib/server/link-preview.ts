export interface LinkPreviewData {
	url: string
	title?: string
	description?: string
	image?: string
	site_name?: string
	domain: string
	favicon?: string
}

/**
 * Checks if a hostname or IP address is private/local to prevent SSRF vulnerabilities.
 */
export function is_private_or_restricted_host(hostname: string): boolean {
	const host = hostname.toLowerCase().trim()

	// Direct loopback / local names
	if (
		host === 'localhost' ||
		host === '127.0.0.1' ||
		host === '0.0.0.0' ||
		host === '::1' ||
		host === '[::1]' ||
		host.endsWith('.local') ||
		host.endsWith('.internal') ||
		host.endsWith('.localhost')
	) {
		return true
	}

	// IPv4 Private & Link-Local Ranges:
	// 10.0.0.0/8
	// 127.0.0.0/8
	// 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
	// 192.168.0.0/16
	// 169.254.0.0/16 (link-local, cloud metadata service like AWS 169.254.169.254)
	const ipv4_match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
	if (ipv4_match) {
		const [, a, b] = ipv4_match.map(Number)
		if (a === 127 || a === 10 || a === 0) return true
		if (a === 169 && b === 254) return true
		if (a === 192 && b === 168) return true
		if (a === 172 && b >= 16 && b <= 31) return true
	}

	// IPv6 Local / Unique Local
	if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) {
		return true
	}

	return false
}

/**
 * Basic HTML entity decoder
 */
export function decode_html_entities(str: string): string {
	return str
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'")
		.replace(/&#x2F;/g, '/')
		.replace(/&nbsp;/g, ' ')
		.replace(/&#(\d+);/g, (_, dec) => {
			try {
				return String.fromCharCode(Number(dec))
			} catch {
				return _
			}
		})
}

/**
 * Extracts Open Graph, Twitter Cards, and standard metadata from raw HTML.
 */
export function parse_html_metadata(html: string, original_url: string): LinkPreviewData {
	const parsed_url = new URL(original_url)
	const domain = parsed_url.hostname.replace(/^www\./i, '')

	// Extract title: og:title -> twitter:title -> <title>
	let title: string | undefined
	const og_title =
		html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
		html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)
	const twitter_title =
		html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i) ||
		html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:title["']/i)
	const doc_title = html.match(/<title[^>]*>([^<]+)<\/title>/i)

	if (og_title?.[1]) {
		title = og_title[1]
	} else if (twitter_title?.[1]) {
		title = twitter_title[1]
	} else if (doc_title?.[1]) {
		title = doc_title[1]
	}

	// Extract description: og:description -> twitter:description -> meta description
	let description: string | undefined
	const og_desc =
		html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
		html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)
	const twitter_desc =
		html.match(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i) ||
		html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:description["']/i)
	const meta_desc =
		html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
		html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)

	if (og_desc?.[1]) {
		description = og_desc[1]
	} else if (twitter_desc?.[1]) {
		description = twitter_desc[1]
	} else if (meta_desc?.[1]) {
		description = meta_desc[1]
	}

	// Extract image: og:image -> twitter:image
	let image: string | undefined
	const og_img =
		html.match(
			/<meta[^>]+property=["'](?:og:image|og:image:url|og:image:secure_url)["'][^>]+content=["']([^"']+)["']/i,
		) ||
		html.match(
			/<meta[^>]+content=["']([^"']+)["'][^>]+property=["'](?:og:image|og:image:url|og:image:secure_url)["']/i,
		)
	const twitter_img =
		html.match(
			/<meta[^>]+name=["'](?:twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)["']/i,
		) ||
		html.match(
			/<meta[^>]+content=["']([^"']+)["'][^>]+name=["'](?:twitter:image|twitter:image:src)["']/i,
		)

	const raw_image = og_img?.[1] || twitter_img?.[1]
	if (raw_image) {
		try {
			image = new URL(raw_image.trim(), original_url).href
		} catch {
			// ignore invalid image URL
		}
	}

	// Extract site_name: og:site_name
	let site_name: string | undefined
	const og_site =
		html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
		html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i)
	if (og_site?.[1]) {
		site_name = decode_html_entities(og_site[1].trim())
	} else {
		site_name = domain
	}

	// Extract favicon: <link rel="icon" ...> or <link rel="shortcut icon" ...>
	let favicon: string | undefined
	const icon_match =
		html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i) ||
		html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i)
	if (icon_match?.[1]) {
		try {
			favicon = new URL(icon_match[1].trim(), original_url).href
		} catch {
			// ignore invalid favicon
		}
	}
	if (!favicon) {
		favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`
	}

	return {
		url: original_url,
		title: title ? decode_html_entities(title.trim()) : domain,
		description: description ? decode_html_entities(description.trim()) : undefined,
		image,
		site_name,
		domain,
		favicon,
	}
}

/**
 * Fetches and parses link preview metadata safely with SSRF protection and timeout.
 */
export async function fetch_link_preview(target_url: string): Promise<LinkPreviewData> {
	let parsed: URL
	try {
		parsed = new URL(target_url)
	} catch {
		throw new Error('Invalid URL format')
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new Error('Unsupported protocol')
	}

	if (is_private_or_restricted_host(parsed.hostname)) {
		throw new Error('Access to private/local network addresses is prohibited')
	}

	const controller = new AbortController()
	const timeout_id = setTimeout(() => controller.abort(), 4000)

	try {
		const response = await fetch(target_url, {
			signal: controller.signal,
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (compatible; SNSPreviewBot/1.0)',
				Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.9',
			},
			redirect: 'follow',
		})

		if (!response.ok) {
			const domain = parsed.hostname.replace(/^www\./i, '')
			return {
				url: target_url,
				title: domain,
				domain,
				site_name: domain,
				favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
			}
		}

		// Read up to 256KB of HTML
		const content_type = response.headers.get('content-type') || ''
		if (!content_type.includes('text/html') && !content_type.includes('application/xhtml+xml')) {
			const domain = parsed.hostname.replace(/^www\./i, '')
			return {
				url: target_url,
				title: domain,
				domain,
				site_name: domain,
				favicon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
			}
		}

		// Read response body text safely capped at 256KB
		const text = await response.text()
		const capped_html = text.slice(0, 262144)

		return parse_html_metadata(capped_html, target_url)
	} finally {
		clearTimeout(timeout_id)
	}
}
