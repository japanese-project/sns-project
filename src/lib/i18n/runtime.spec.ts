import { describe, expect, it } from 'vitest'
import { get } from 'svelte/store'
import en from '$lib/locales/en.json'
import { current_locale, init_i18n, locale, set_locale, t } from './index'

// `$t()` is a store wrapping svelte-i18n's `formatMessage`; this mirrors its call signature so
// the helper below can be typed without losing the second argument.
type TranslateOptions = { values?: Record<string, unknown> }
type Format = (id: string, options?: TranslateOptions) => string

function lookup(key: string, options?: TranslateOptions): string {
	return (get(t) as unknown as Format)(key, options)
}

// Proves the piece the component tests depend on: `$t()` resolves to real English copy with no
// load function having run, because `en` is added synchronously at module init.
describe('i18n runtime', () => {
	it('resolves English without waiting for a load function', () => {
		expect(lookup('nav.home')).toBe('Home')
		expect(lookup('post.copy_link')).toBe('Copy link')
	})

	it('starts in English', () => {
		expect(current_locale()).toBe('en')
	})

	it('interpolates values', () => {
		expect(lookup('nav.notifications_unread', { values: { count: 3 } })).toBe(
			'Notifications, 3 unread',
		)
	})

	it('picks the plural form that matches the count', () => {
		expect(lookup('sidebar.post_count', { values: { count: 1 } })).toBe('1 post')
		expect(lookup('sidebar.post_count', { values: { count: 5 } })).toBe('5 posts')
	})

	it('returns the key for a missing translation instead of empty text', () => {
		expect(lookup('nav.definitely_not_a_key')).toBe('nav.definitely_not_a_key')
	})

	it('loads a locale and switches the resolved copy', async () => {
		await init_i18n('ja-JP')
		expect(current_locale()).toBe('ja')
		expect(lookup('nav.home')).toBe('ホーム')
		expect(get(locale)).toBe('ja')
	})

	it('switches to Khmer', async () => {
		await set_locale('km')
		expect(current_locale()).toBe('km')
		expect(lookup('nav.home')).toBe('ទំព័រដើម')
	})

	it('ignores an unsupported locale request', async () => {
		const before = current_locale()
		await init_i18n('fr-FR')
		expect(current_locale()).toBe(before)
	})

	it('keeps a locale the user explicitly chose, ignoring later negotiation', async () => {
		await set_locale('ja')
		// A client-side navigation re-runs the layout load with the browser's Accept-Language.
		// It must not override the explicit choice.
		await init_i18n('en-US')
		expect(current_locale()).toBe('ja')
	})
})

describe('English dictionary shape', () => {
	it('nests the keys the components use at the expected paths', () => {
		const messages = en as unknown as Record<string, Record<string, string>>
		expect(messages.nav.home).toBe('Home')
		expect(messages.time.minutes_ago).toBe('{count}m ago')
	})
})
