// Locale registry shared by the runtime (`./index`), `Accept-Language` negotiation, and the
// language switcher. Kept in its own module so the server can negotiate without pulling in
// svelte-i18n (and so nothing here needs a browser).

export const supported_locales = [
	{ code: 'en', name: 'English' },
	{ code: 'ja', name: '日本語' },
	{ code: 'km', name: 'ខ្មែរ' },
] as const

export type Locale = (typeof supported_locales)[number]['code']

export const default_locale: Locale = 'en'

const locale_codes: readonly string[] = supported_locales.map((l) => l.code)

export function is_supported_locale(value: string | null | undefined): value is Locale {
	return !!value && locale_codes.includes(value)
}

/**
 * Reduce a BCP-47 tag to one of our locale codes: lowercases, and drops the region/script
 * subtags. `ja-JP`, `ja-jp` and `JA` all resolve to `ja`. Returns null for anything we don't
 * ship, so the caller can fall back rather than registering an unusable dictionary.
 *
 * Note `jp` and `kh` are country codes, not language tags — Intl silently falls back to English
 * for them, so they must not be accepted here.
 */
export function resolve_locale(tag: string | null | undefined): Locale | null {
	if (!tag) return null
	const language = tag.trim().toLowerCase().split(/[-_]/)[0]
	return is_supported_locale(language) ? language : null
}

/**
 * Pick the best supported locale from an `Accept-Language` header, honouring q-values.
 * Falls back to `default_locale` when the header is absent or matches nothing.
 */
export function negotiate_locale(header: string | null | undefined): Locale {
	if (!header) return default_locale

	const ranked = header
		.split(',')
		.map((part, index) => {
			const [tag, ...params] = part.trim().split(';')
			const q_param = params.find((p) => p.trim().startsWith('q='))
			const parsed = q_param ? Number.parseFloat(q_param.trim().slice(2)) : 1
			return { tag: tag.trim(), quality: Number.isNaN(parsed) ? 0 : parsed, index }
		})
		.filter((entry) => entry.tag && entry.quality > 0)
		// Stable sort: equal q-values keep header order, as browsers send preference order.
		.sort((a, b) => b.quality - a.quality || a.index - b.index)

	for (const entry of ranked) {
		const matched = resolve_locale(entry.tag)
		if (matched) return matched
	}
	return default_locale
}
