import { describe, expect, it } from 'vitest'
import { relative_time_parts } from './time'

const now = Date.parse('2026-01-10T12:00:00Z')
const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString()

describe('relative_time_parts', () => {
	it('buckets recent times into translation keys', () => {
		expect(relative_time_parts(ago(5), now)).toEqual({ key: 'time.just_now', count: 0 })
		expect(relative_time_parts(ago(5 * 60), now)).toEqual({ key: 'time.minutes_ago', count: 5 })
		expect(relative_time_parts(ago(2 * 3600), now)).toEqual({ key: 'time.hours_ago', count: 2 })
		expect(relative_time_parts(ago(3 * 86400), now)).toEqual({ key: 'time.days_ago', count: 3 })
	})

	it('returns null past the cutoff so the caller can render an absolute date', () => {
		expect(relative_time_parts(ago(6 * 86400), now)).toEqual({ key: 'time.days_ago', count: 6 })
		expect(relative_time_parts(ago(30 * 86400), now)).toBeNull()
	})

	it('never returns a negative time for future timestamps', () => {
		expect(relative_time_parts(ago(-60), now)).toEqual({ key: 'time.just_now', count: 0 })
	})
})
