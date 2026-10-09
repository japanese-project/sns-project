import type { LayoutLoad } from './$types'
import { init_i18n } from '$lib/i18n'

/**
 * Loads the locale dictionary *before* anything renders. Awaiting in a load function (rather
 * than wrapping the app in `{#await waitLocale()}`, as the tutorial's `App.svelte` does) is what
 * keeps SSR output and the hydrated tree in the same language: an `{#await}` block renders its
 * pending branch on the server, which would emit raw keys or English into the HTML.
 *
 * `init_i18n` no-ops once the user has explicitly chosen a language, so client-side navigations
 * don't revert their pick back to the browser's preference.
 */
export const load: LayoutLoad = async ({ data }) => {
	const locale = await init_i18n(data.locale)
	// `data` already holds the server layout's output (user, session, locale); returning it
	// alongside the resolved locale keeps the layout data shape intact, since SvelteKit types
	// this universal load's return as the complete layout data rather than merging the two.
	return { ...data, locale }
}
