import { describe, expect, it } from 'vitest'
import { check_migration_sql } from './validate-migrations'

describe('check_migration_sql', () => {
	it('passes for backward-compatible statements', () => {
		const sql = `
			CREATE TABLE new_table (
				id text PRIMARY KEY NOT NULL,
				content text
			);
			--> statement-breakpoint
			CREATE INDEX new_table_idx ON new_table(content);
			--> statement-breakpoint
			ALTER TABLE user ADD COLUMN nickname text;
			--> statement-breakpoint
			ALTER TABLE user ADD COLUMN status text NOT NULL DEFAULT 'active';
		`
		const issues = check_migration_sql(sql, '0001_safe.sql')
		expect(issues).toHaveLength(0)
	})

	it('detects DROP TABLE', () => {
		const sql = 'DROP TABLE old_posts;'
		const issues = check_migration_sql(sql, '0002_drop.sql')
		expect(issues).toHaveLength(1)
		expect(issues[0].statement).toContain('DROP TABLE')
		expect(issues[0].reason).toContain('DROP TABLE breaks')
	})

	it('detects DROP COLUMN in ALTER TABLE', () => {
		const sql = 'ALTER TABLE post DROP COLUMN deprecated_field;'
		const issues = check_migration_sql(sql, '0003_drop_col.sql')
		expect(issues.length).toBeGreaterThan(0)
	})

	it('detects RENAME COLUMN in ALTER TABLE', () => {
		const sql = 'ALTER TABLE post RENAME COLUMN old_name TO new_name;'
		const issues = check_migration_sql(sql, '0004_rename.sql')
		expect(issues.length).toBeGreaterThan(0)
	})

	it('detects ADD COLUMN with NOT NULL but no DEFAULT', () => {
		const sql = 'ALTER TABLE user ADD COLUMN required_field text NOT NULL;'
		const issues = check_migration_sql(sql, '0005_not_null_no_default.sql')
		expect(issues).toHaveLength(1)
		expect(issues[0].reason).toContain('without a DEFAULT')
	})

	it('detects statements outside the safe allowlist (e.g. table recreate)', () => {
		const sql = 'UPDATE user SET email = lower(email);'
		const issues = check_migration_sql(sql, '0006_arbitrary_dml.sql')
		expect(issues).toHaveLength(1)
		expect(issues[0].reason).toContain('safe allowlist')
	})

	it('allows destructive statement when explicit bypass comment is present', () => {
		const sql = `
			-- allow-destructive-migration: intentional cleanup after Phase 5
			DROP TABLE obsolete_cache;
		`
		const issues = check_migration_sql(sql, '0007_bypass.sql')
		expect(issues).toHaveLength(0)
	})
})
