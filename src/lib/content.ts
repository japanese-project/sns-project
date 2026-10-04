export type ContentSegment =
	| { type: 'text'; text: string }
	| { type: 'tag'; text: string; href: string }
	| { type: 'link'; text: string; href: string }

/**
 * Strips trailing punctuation from matched URL tokens so that sentences like
 * "visit https://example.com." or "(https://example.com)" keep punctuation outside the link.
 */
function clean_trailing_url(raw_url: string): { url: string; trailing: string } {
	let url = raw_url
	let trailing = ''

	while (url.length > 0) {
		const last_char = url[url.length - 1]
		if (['.', ',', ';', ':', '!', '?', "'", '"', '>', '`'].includes(last_char)) {
			trailing = last_char + trailing
			url = url.slice(0, -1)
		} else if (last_char === ')') {
			const open_count = (url.match(/\(/g) || []).length
			const close_count = (url.match(/\)/g) || []).length
			if (close_count > open_count) {
				trailing = last_char + trailing
				url = url.slice(0, -1)
			} else {
				break
			}
		} else if (last_char === ']') {
			const open_count = (url.match(/\[/g) || []).length
			const close_count = (url.match(/\]/g) || []).length
			if (close_count > open_count) {
				trailing = last_char + trailing
				url = url.slice(0, -1)
			} else {
				break
			}
		} else {
			break
		}
	}

	return { url, trailing }
}

/**
 * Parses user or bot text into tokens containing plain text, hashtags, and clickable web links.
 * URLs take precedence over hashtags so hash fragments in URLs are not misidentified as tags.
 * When `exclude_url` is provided, that URL is omitted from the parsed text segments so that
 * the raw URL and rich link preview card can be unified into a single presentation.
 */
export function parse_content(
	text: string,
	options?: { exclude_url?: string | null },
): ContentSegment[] {
	if (!text) return []

	// Matches URLs (http, https, or www.) or hashtags
	const token_regex =
		/(https?:\/\/[^\s<>"'`]+|www\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s<>"'`]*|#[a-zA-Z0-9_\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+)/gi

	const segments: ContentSegment[] = []
	let last_index = 0
	let match: RegExpExecArray | null

	const push_text = (t: string) => {
		if (!t) return
		const prev = segments[segments.length - 1]
		if (prev && prev.type === 'text') {
			prev.text += t
		} else {
			segments.push({ type: 'text', text: t })
		}
	}

	while ((match = token_regex.exec(text)) !== null) {
		const match_start = match.index
		const match_str = match[0]

		if (match_start > last_index) {
			push_text(text.slice(last_index, match_start))
		}

		if (match_str.startsWith('#')) {
			if (match_str.length > 1) {
				segments.push({
					type: 'tag',
					text: match_str,
					href: `/explore?q=${encodeURIComponent(match_str)}`,
				})
			} else {
				push_text(match_str)
			}
			last_index = token_regex.lastIndex
		} else {
			// URL (http://, https://, or www.)
			const { url, trailing } = clean_trailing_url(match_str)
			if (url.length > 0) {
				const href =
					url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`

				if (options?.exclude_url && (href === options.exclude_url || url === options.exclude_url)) {
					// Omit the raw link so it is unified into the preview card
					if (trailing.length > 0) {
						push_text(trailing)
					}
					const prev = segments[segments.length - 1]
					if (prev && prev.type === 'text' && /\s+$/.test(prev.text)) {
						prev.text = prev.text.replace(/\s+$/, ' ')
					}
					last_index = token_regex.lastIndex
					if (text[last_index] === ' ' && prev && prev.type === 'text' && prev.text.endsWith(' ')) {
						last_index++
					}
					continue
				}

				segments.push({
					type: 'link',
					text: url,
					href,
				})
			}
			if (trailing.length > 0) {
				push_text(trailing)
			}
			last_index = token_regex.lastIndex
		}
	}

	if (last_index < text.length) {
		push_text(text.slice(last_index))
	}

	if (options?.exclude_url) {
		const has_real_content = segments.some((s) => s.type !== 'text' || s.text.trim().length > 0)
		if (!has_real_content) {
			return []
		}
	}

	return segments
}
