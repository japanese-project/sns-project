// Vitest setup for the browser project. The locale store is module-global, so a spec file that
// switches language (LanguageSelect) would otherwise leave Japanese or Khmer active for whichever
// spec file runs next in the same worker, breaking assertions on English copy.
import { afterAll, afterEach, beforeEach } from 'vitest'
import { default_locale, set_locale } from '$lib/i18n'

beforeEach(async () => {
	await set_locale(default_locale)
})

afterEach(async () => {
	await set_locale(default_locale)
})

afterAll(async () => {
	await set_locale(default_locale)
})
