import { describe, expect, it } from 'vitest'
import en from '$lib/locales/en.json'
import ja from '$lib/locales/ja.json'
import km from '$lib/locales/km.json'
import { available_interests, interest_i18n_key } from './interests'

const dictionaries = { en, ja, km } as unknown as Record<string, Record<string, unknown>>

/** Resolve `interests.technology` out of a nested dictionary object. */
function lookup(dictionary: Record<string, unknown>, key: string): string | undefined {
	let node: unknown = dictionary
	for (const part of key.split('.')) {
		if (node === null || typeof node !== 'object') return undefined
		node = (node as Record<string, unknown>)[part]
	}
	return typeof node === 'string' ? node : undefined
}

describe('interests', () => {
	it('gives every preset interest a translation in every locale', () => {
		for (const value of available_interests) {
			const key = interest_i18n_key(value)
			expect(key, `no i18n key for "${value}"`).not.toBeNull()
			for (const [code, dictionary] of Object.entries(dictionaries)) {
				expect(lookup(dictionary, key as string), `${code}:${key}`).toBeTypeOf('string')
			}
		}
	})

	it('keeps the stored value identical to the English label', () => {
		// The stored value is what gets written to the DB and linked as `#Topic` in explore, so it
		// must never drift from `en.interests.*` or existing user rows stop matching.
		for (const value of available_interests) {
			const key = interest_i18n_key(value) as string
			expect(lookup(en as unknown as Record<string, unknown>, key)).toBe(value)
		}
	})

	it('returns null for custom topics so callers can fall back to the raw value', () => {
		expect(interest_i18n_key('Birdwatching')).toBeNull()
		expect(interest_i18n_key('')).toBeNull()
		// Case matters: these are stored values, not free text.
		expect(interest_i18n_key('technology')).toBeNull()
	})
})
