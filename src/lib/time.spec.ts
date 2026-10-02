import { describe, expect, it } from 'vitest'
import { relative_time } from './time'

const now = Date.parse('2026-01-10T12:00:00Z')
const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString()

describe('relative_time', () => {
	it('formats recent times', () => {
		expect(relative_time(ago(5), now)).toBe('just now')
		expect(relative_time(ago(5 * 60), now)).toBe('5m ago')
		expect(relative_time(ago(2 * 3600), now)).toBe('2h ago')
		expect(relative_time(ago(3 * 86400), now)).toBe('3d ago')
	})

	it('falls back to a date after a week', () => {
		expect(relative_time(ago(30 * 86400), now)).toMatch(/2025/)
	})

	it('never returns a negative time for future timestamps', () => {
		expect(relative_time(ago(-60), now)).toBe('just now')
	})
})
