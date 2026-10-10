import { describe, expect, it } from 'vitest'
import { default_locale, is_supported_locale, negotiate_locale, resolve_locale } from './locales'

describe('is_supported_locale', () => {
	it('accepts exactly the shipped codes', () => {
		expect(is_supported_locale('en')).toBe(true)
		expect(is_supported_locale('ja')).toBe(true)
		expect(is_supported_locale('km')).toBe(true)
		expect(is_supported_locale('fr')).toBe(false)
		expect(is_supported_locale(null)).toBe(false)
	})
})

describe('resolve_locale', () => {
	it('drops region and script subtags', () => {
		expect(resolve_locale('ja-JP')).toBe('ja')
		expect(resolve_locale('JA-jp')).toBe('ja')
		expect(resolve_locale('km-KH')).toBe('km')
		expect(resolve_locale('en_US')).toBe('en')
	})

	it('rejects country codes that are not language tags', () => {
		// Intl silently falls back to English for these, so accepting them would ship a locale
		// whose dates and numbers render in the wrong language.
		expect(resolve_locale('jp')).toBeNull()
		expect(resolve_locale('kh')).toBeNull()
	})

	it('returns null for anything unsupported', () => {
		expect(resolve_locale('fr-FR')).toBeNull()
		expect(resolve_locale('')).toBeNull()
		expect(resolve_locale(undefined)).toBeNull()
	})
})

describe('negotiate_locale', () => {
	it('falls back to English when there is no header', () => {
		expect(negotiate_locale(null)).toBe(default_locale)
		expect(negotiate_locale('')).toBe(default_locale)
	})

	it('picks the highest-weighted supported language', () => {
		expect(negotiate_locale('ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7')).toBe('ja')
		expect(negotiate_locale('km-KH,km;q=0.9')).toBe('km')
		expect(negotiate_locale('fr-FR,fr;q=0.9')).toBe(default_locale)
	})

	it('honours q-values over header order', () => {
		expect(negotiate_locale('en;q=0.2,ja;q=0.9')).toBe('ja')
	})

	it('keeps header order when weights are equal', () => {
		expect(negotiate_locale('km,ja')).toBe('km')
	})

	it('ignores unusable entries and q=0 rejections', () => {
		expect(negotiate_locale('fr;q=1.0,ja;q=0.5')).toBe('ja')
		expect(negotiate_locale('ja;q=0,fr;q=0.1')).toBe(default_locale)
	})

	it('matches a regional tag to its base language', () => {
		expect(negotiate_locale('ja-JP')).toBe('ja')
		expect(negotiate_locale('km-KH')).toBe('km')
	})
})
