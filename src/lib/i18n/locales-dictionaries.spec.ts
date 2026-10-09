import { describe, expect, it } from 'vitest'
import en from '$lib/locales/en.json'
import ja from '$lib/locales/ja.json'
import km from '$lib/locales/km.json'
import { supported_locales } from './locales'

// The imports are deeply-typed literal JSON objects; the checks below walk them generically.
const dictionaries = {
	en,
	ja,
	km,
} as unknown as Record<string, unknown>

/** Flatten `{ a: { b: 'c' } }` to `{ 'a.b': 'c' }` so a key is a single comparable string. */
function flatten(source: unknown, prefix = ''): Map<string, string> {
	const out = new Map<string, string>()
	for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
		const path = prefix ? `${prefix}.${key}` : key
		if (value !== null && typeof value === 'object') {
			for (const [nested, text] of flatten(value, path)) out.set(nested, text)
		} else {
			out.set(path, String(value))
		}
	}
	return out
}

const flattened = Object.fromEntries(
	Object.entries(dictionaries).map(([code, messages]) => [code, flatten(messages)]),
)

/** Pull the `{placeholder}` names out of a message, so all locales must agree on them. */
function placeholders(message: string): string[] {
	return [...message.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort()
}

describe('locale dictionaries', () => {
	it('ships one dictionary per supported locale', () => {
		expect(Object.keys(dictionaries).sort()).toEqual(supported_locales.map((l) => l.code).sort())
	})

	it('has identical keys in every locale', () => {
		const expected = [...flattened.en.keys()].sort()
		for (const code of ['ja', 'km']) {
			expect([...flattened[code].keys()].sort()).toEqual(expected)
		}
	})

	it('has no empty translations', () => {
		for (const [code, messages] of Object.entries(flattened)) {
			for (const [key, value] of messages) {
				expect(value.trim(), `${code}:${key}`).not.toBe('')
			}
		}
	})

	it('keeps the same interpolation placeholders as English', () => {
		for (const key of flattened.en.keys()) {
			const expected = placeholders(flattened.en.get(key) as string)
			for (const code of ['ja', 'km']) {
				expect(placeholders(flattened[code].get(key) as string), `${code}:${key}`).toEqual(expected)
			}
		}
	})

	it('actually translates, rather than copying English', () => {
		// Example input that is deliberately language-agnostic — a tag list is tags everywhere.
		const untranslatable = new Set(['admin.hashtags_placeholder'])

		for (const key of flattened.en.keys()) {
			if (untranslatable.has(key)) continue
			for (const code of ['ja', 'km']) {
				const translation = flattened[code].get(key) as string
				// A match here means the string was copied instead of translated.
				expect(translation, `${code}:${key}`).not.toBe(flattened.en.get(key))
			}
		}
	})

	it('uses the right script for each locale', () => {
		const script_ranges: Record<string, [number, number]> = {
			// Kanji sits in CJK ideographs, kana in the kana block; check both.
			ja: [0x3000, 0x9fff],
			km: [0x1780, 0x17ff],
		}
		for (const [code, [low, high]] of Object.entries(script_ranges)) {
			const with_latin_only = [...flattened[code].entries()]
				.filter(([, value]) => !/[A-Za-z]/.test(value))
				.filter(([, value]) =>
					[...value].every((ch) => {
						const point = ch.codePointAt(0) as number
						return point < low || point > high
					}),
				)
			expect(with_latin_only.map(([key]) => key)).toEqual([])
		}
	})
})
