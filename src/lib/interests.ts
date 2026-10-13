// Interest/topic tags shown in the onboarding and edit-profile pickers.
//
// These strings are the canonical *stored* values: they are written to the user row, matched
// against `selected_interests` to split known from custom topics, and linked as `#Technology` in
// explore searches. So the stored value must stay English and stable no matter which language the
// UI is in — translating here would orphan every existing row.
//
// Translation therefore happens at render time only, through `interest_i18n_key` + the
// `interests.*` locale entries. Unknown values (the user's own custom topics) return null and the
// caller falls back to printing the raw string.

export const available_interests: readonly string[] = [
	'Technology',
	'Design',
	'Photography',
	'Music',
	'Writing',
	'Gaming',
	'Science',
	'Travel',
	'Art',
	'Food & Cooking',
	'Books',
	'Open Source',
]

/** Stored value -> `interests.*` locale key. Kept explicit so the mapping survives copy edits. */
const interest_i18n_keys: Record<string, string> = {
	Technology: 'technology',
	Design: 'design',
	Photography: 'photography',
	Music: 'music',
	Writing: 'writing',
	Gaming: 'gaming',
	Science: 'science',
	Travel: 'travel',
	Art: 'art',
	'Food & Cooking': 'food_cooking',
	Books: 'books',
	'Open Source': 'open_source',
}

/**
 * Locale key for a stored interest, or null when it's a user-typed custom topic that we have no
 * translation for. Callers should render `{$t(key)}` when non-null and the raw value otherwise.
 */
export function interest_i18n_key(value: string): string | null {
	const key = interest_i18n_keys[value]
	return key ? `interests.${key}` : null
}
