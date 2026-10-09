// i18n runtime — the SvelteKit counterpart of the freeCodeCamp tutorial's `src/i18n.js`.
//
//   register('ja', () => import('./locales/ja.json'))   -> code-split, lazy-loaded per locale
//   addMessages('en', en)                               -> English available synchronously
//   init({ fallbackLocale, initialLocale })             -> sets up options + locale store
//
// Why `addMessages` for English instead of a loader like the others: English is the fallback
// locale, so its messages must exist *before* the first render. Registering a loader would make
// `$t()` resolve to raw keys until the async flush completed — during SSR that bakes keys into
// the HTML, and in the component tests (which mount components standalone, with no layout load
// to await) it would break every assertion on English copy.

import { _ as i18n_t_store, addMessages, init, locale as locale_store, register } from 'svelte-i18n'
import { get } from 'svelte/store'
import en from '$lib/locales/en.json'
import {
	default_locale,
	is_supported_locale,
	resolve_locale,
	supported_locales,
	type Locale,
} from './locales'

export { date, number, time } from 'svelte-i18n'
export { default_locale, is_supported_locale, resolve_locale, supported_locales, type Locale }

/** Locale the user explicitly picked, or null while they're still on the detected default. */
let chosen_locale: Locale | null = null

register('ja', () => import('$lib/locales/ja.json'))
register('km', () => import('$lib/locales/km.json'))
addMessages('en', en)

// `init` applies its options synchronously and only the locale load is async, so importing this
// module is enough to make `$t()` safe to call anywhere — including components mounted outside
// the app's load functions.
void init({
	fallbackLocale: default_locale,
	initialLocale: default_locale,
	// Show the key rather than an empty string, so a missing translation is obvious but not fatal.
	handleMissingMessage: ({ id }) => id,
})

/** Translation lookup. Use as `{$t('nav.home')}` — the store subscription is what re-renders on
 *  a language change, so never wrap it in a helper function. */
export const t = i18n_t_store

export const locale = locale_store

export function current_locale(): Locale {
	const value = get(locale)
	return is_supported_locale(value) ? value : default_locale
}

/**
 * Switch language and wait for its dictionary to load. Records the choice so the root layout
 * load leaves it alone afterwards.
 */
export async function set_locale(next: Locale): Promise<void> {
	if (!is_supported_locale(next)) return
	chosen_locale = next
	await locale.set(next)
}

/**
 * Point the runtime at `target` (a request's negotiated locale) and wait for its dictionary to
 * load. No-ops once the user has picked a language themselves, so a client-side navigation never
 * silently reverts their choice. Awaiting this before render is what keeps the SSR output and the
 * hydrated tree in the same language.
 */
export async function init_i18n(target?: string | null): Promise<Locale> {
	if (chosen_locale) return current_locale()
	const next = resolve_locale(target) ?? default_locale
	if (get(locale) !== next) {
		await init({ fallbackLocale: default_locale, initialLocale: next })
	}
	return current_locale()
}
