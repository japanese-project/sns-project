export interface LinkPreviewData {
	url: string
	title?: string
	description?: string
	image?: string
	site_name?: string
	domain: string
	favicon?: string
}

// Global client-side cache for link previews to prevent refetching the same URL
const preview_cache = new Map<string, Promise<LinkPreviewData | null>>()

/**
 * Extracts the first valid HTTP/HTTPS URL from a string, if any.
 */
export function extract_first_url(text: string): string | null {
	if (!text) return null
	const match = text.match(/(https?:\/\/[^\s<>"'`]+|www\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s<>"'`]*)/i)
	if (!match) return null

	let url = match[0]
	// Clean trailing punctuation
	while (
		url.length > 0 &&
		['.', ',', ';', ':', '!', '?', "'", '"', '>', '`', ')', ']'].includes(url[url.length - 1])
	) {
		url = url.slice(0, -1)
	}
	if (!url) return null

	return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
}

/**
 * Fetches link preview with in-memory caching.
 */
export async function get_link_preview(url: string): Promise<LinkPreviewData | null> {
	if (!url) return null

	const cached = preview_cache.get(url)
	if (cached) return cached

	const promise = (async () => {
		try {
			const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
			if (!res.ok) {
				return null
			}
			const data = (await res.json()) as { preview?: LinkPreviewData }
			return data.preview ?? null
		} catch {
			return null
		}
	})()

	preview_cache.set(url, promise)
	return promise
}
