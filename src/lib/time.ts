const minute = 60
const hour = 60 * minute
const day = 24 * hour

/** Past this, an absolute date reads better than "3w ago". */
export const relative_time_cutoff_days = 7

export interface RelativeTimeParts {
	/** Translation key under `time` in the locale dictionaries. */
	key: 'time.just_now' | 'time.minutes_ago' | 'time.hours_ago' | 'time.days_ago'
	count: number
}

/**
 * Buckets a timestamp into a translation key and a count, leaving the wording to the locale
 * dictionaries. Returns null once the timestamp is older than {@link relative_time_cutoff_days},
 * signalling the caller to render a formatted date instead.
 */
export function relative_time_parts(
	iso: string,
	now: number = Date.now(),
): RelativeTimeParts | null {
	const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
	if (seconds < 45) return { key: 'time.just_now', count: 0 }
	if (seconds < hour)
		return { key: 'time.minutes_ago', count: Math.max(1, Math.round(seconds / minute)) }
	if (seconds < day) return { key: 'time.hours_ago', count: Math.round(seconds / hour) }
	if (seconds < relative_time_cutoff_days * day)
		return { key: 'time.days_ago', count: Math.round(seconds / day) }
	return null
}
