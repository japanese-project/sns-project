import { describe, expect, it } from 'vitest'
import { MAX_INTEREST_LENGTH, MAX_INTERESTS_COUNT } from '$lib/limits'
import { is_unique_constraint_error, validate_interests } from './validation'

function status_of(fn: () => unknown) {
	try {
		fn()
		return 200
	} catch (e) {
		return (e as { status?: number }).status ?? 500
	}
}

describe('is_unique_constraint_error', () => {
	it('detects a raw D1 unique violation', () => {
		const err = new Error(
			'D1_ERROR: UNIQUE constraint failed: user.username: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_UNIQUE)',
		)
		expect(is_unique_constraint_error(err)).toBe(true)
	})

	// Regression: drizzle >= 0.44 wraps driver errors; its own message is only the SQL text,
	// so inspecting `err.message` alone never matched and races surfaced as 500s.
	it('detects a unique violation wrapped in a DrizzleQueryError-style cause chain', () => {
		const wrapped = new Error(
			'Failed query: update "user" set "username" = ? where "user"."id" = ?',
			{
				cause: new Error('D1_ERROR: UNIQUE constraint failed: user.username: SQLITE_CONSTRAINT'),
			},
		)
		expect(is_unique_constraint_error(wrapped)).toBe(true)
	})

	it('does not treat other database errors as unique violations', () => {
		expect(is_unique_constraint_error(new Error('D1_ERROR: database is locked'))).toBe(false)
		expect(
			is_unique_constraint_error(
				new Error('Failed query: ...', {
					cause: new Error('D1_ERROR: NOT NULL constraint failed: user.name: SQLITE_CONSTRAINT'),
				}),
			),
		).toBe(false)
		expect(
			is_unique_constraint_error(new Error('Failed query: select * from "unique_things"')),
		).toBe(false)
	})

	it('handles non-Error values and cyclic cause chains', () => {
		expect(is_unique_constraint_error(undefined)).toBe(false)
		expect(is_unique_constraint_error('UNIQUE constraint failed')).toBe(false)
		const a = new Error('a')
		const b = new Error('b', { cause: a })
		a.cause = b
		expect(is_unique_constraint_error(a)).toBe(false)
	})
})

describe('validate_interests', () => {
	it('trims values, drops empty ones and keeps order', () => {
		expect(validate_interests(['  Music  ', '', '   ', 'Art'])).toEqual(['Music', 'Art'])
	})

	it('accepts spaces, punctuation, CJK and emoji', () => {
		const ok = ['machine learning', 'C++', 'ミュージック', '日本語', 'travel ✈️']
		expect(validate_interests(ok)).toEqual(ok)
	})

	it('rejects input that is not an array', () => {
		for (const bad of ['music', { 0: 'music' }, 42, true]) {
			expect(status_of(() => validate_interests(bad))).toBe(400)
		}
	})

	it('rejects non-string entries instead of silently dropping them', () => {
		expect(status_of(() => validate_interests(['ok', 42]))).toBe(400)
		expect(status_of(() => validate_interests(['ok', null]))).toBe(400)
		expect(status_of(() => validate_interests([['nested']]))).toBe(400)
	})

	it('enforces the per-value length limit after trimming', () => {
		expect(validate_interests(['a'.repeat(MAX_INTEREST_LENGTH)])).toHaveLength(1)
		expect(validate_interests([`  ${'a'.repeat(MAX_INTEREST_LENGTH)}  `])).toHaveLength(1)
		expect(status_of(() => validate_interests(['a'.repeat(MAX_INTEREST_LENGTH + 1)]))).toBe(400)
	})

	it('rejects control and invisible characters', () => {
		const bad = [
			'bad\x00char', // NUL
			'tab\there', // tab
			'new\nline', // LF
			'del\x7fchar', // DEL
			'c1\x85char', // C1 control (NEL)
			'zero​width', // zero-width space
			'rtl‮override', // bidi override
			'line sep', // line separator
		]
		for (const value of bad) {
			expect({ value, status: status_of(() => validate_interests([value])) }).toEqual({
				value,
				status: 400,
			})
		}
	})

	it('caps the number of interests', () => {
		const many = Array.from({ length: MAX_INTERESTS_COUNT * 3 }, (_, i) => `topic${i}`)
		expect(validate_interests(many)).toHaveLength(MAX_INTERESTS_COUNT)
	})
})
