const minute = 60
const hour = 60 * minute
const day = 24 * hour

export function relative_time(iso: string, now: number = Date.now()): string {
	const seconds = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000))
	if (seconds < 45) return 'just now'
	if (seconds < hour) return `${Math.max(1, Math.round(seconds / minute))}m ago`
	if (seconds < day) return `${Math.round(seconds / hour)}h ago`
	if (seconds < 7 * day) return `${Math.round(seconds / day)}d ago`
	return new Date(iso).toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	})
}
