import fs from 'node:fs'
import path from 'node:path'

export interface MigrationIssue {
	file: string
	line: number
	reason: string
	statement: string
}

export function check_migration_sql(content: string, filename: string): MigrationIssue[] {
	const issues: MigrationIssue[] = []

	// Split by Drizzle's statement breakpoint or semicolons
	const raw_blocks = content.split(/-->\s*statement-breakpoint/i)

	let current_line = 1

	for (const block of raw_blocks) {
		const block_lines = block.split('\n')
		const block_line_count = block_lines.length

		// Check if the block has an explicit bypass annotation
		const has_bypass = block.includes('-- allow-destructive-migration')

		// Strip line comments and block comments for analysis
		const cleaned = block
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/--.*$/gm, '')
			.trim()

		if (!cleaned) {
			current_line += block_line_count
			continue
		}

		if (!has_bypass) {
			validate_statement(cleaned, filename, current_line, issues)
		}

		current_line += block_line_count
	}

	return issues
}

function validate_statement(
	statement: string,
	filename: string,
	line: number,
	issues: MigrationIssue[],
) {
	const normalized = statement.replace(/\s+/g, ' ').trim()
	const preview = normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized

	// 1. Check for DROP TABLE
	if (/\bDROP\s+TABLE\b/i.test(normalized)) {
		issues.push({
			file: filename,
			line,
			statement: preview,
			reason:
				'DROP TABLE breaks existing code and running deployments. Use Expand-Contract pattern.',
		})
		return
	}

	// 2. Check for DROP COLUMN
	if (
		/\bDROP\s+COLUMN\b/i.test(normalized) ||
		/\bALTER\s+TABLE\s+[^;]+\bDROP\b/i.test(normalized)
	) {
		issues.push({
			file: filename,
			line,
			statement: preview,
			reason:
				'Dropping columns removes fields expected by running workers. Use Expand-Contract pattern.',
		})
		return
	}

	// 3. Check for RENAME (table or column)
	if (/\bRENAME\s+COLUMN\b/i.test(normalized) || /\bRENAME\s+TO\b/i.test(normalized)) {
		issues.push({
			file: filename,
			line,
			statement: preview,
			reason:
				'Renaming columns or tables immediately breaks running workers querying the old name.',
		})
		return
	}

	// 4. Check for DROP INDEX
	if (/\bDROP\s+INDEX\b/i.test(normalized)) {
		issues.push({
			file: filename,
			line,
			statement: preview,
			reason: 'Dropping indexes may break constraints or degrade performance on active workloads.',
		})
		return
	}

	// 5. Check ALTER TABLE ADD [COLUMN] ... NOT NULL without DEFAULT
	if (/\bALTER\s+TABLE\s+[^;]+\bADD\s+(COLUMN\s+)?/i.test(normalized)) {
		const is_not_null = /\bNOT\s+NULL\b/i.test(normalized)
		const has_default = /\bDEFAULT\b/i.test(normalized)

		if (is_not_null && !has_default) {
			issues.push({
				file: filename,
				line,
				statement: preview,
				reason:
					'Adding a NOT NULL column without a DEFAULT will cause inserts from the currently deployed Worker to fail.',
			})
			return
		}
	}

	// 6. Positive allowlist check for permitted D1 / SQLite statements:
	// Allowed operations in Expand phase:
	// - CREATE TABLE ...
	// - CREATE [UNIQUE] INDEX ...
	// - ALTER TABLE ... ADD [COLUMN] ...
	const is_create_table = /^\s*CREATE\s+TABLE\b/i.test(normalized)
	const is_create_index = /^\s*CREATE\s+(UNIQUE\s+)?INDEX\b/i.test(normalized)
	const is_alter_add = /^\s*ALTER\s+TABLE\s+[^;]+\bADD\s+(COLUMN\s+)?/i.test(normalized)

	if (!is_create_table && !is_create_index && !is_alter_add) {
		issues.push({
			file: filename,
			line,
			statement: preview,
			reason:
				'Statement is not in the Expand-Contract safe allowlist (CREATE TABLE, CREATE INDEX, or ALTER TABLE ADD [COLUMN] with default).',
		})
	}
}

export function validate_all_migrations(migrations_dir: string): MigrationIssue[] {
	if (!fs.existsSync(migrations_dir)) {
		return []
	}

	const files = fs
		.readdirSync(migrations_dir)
		.filter((f) => f.endsWith('.sql'))
		.sort()

	const all_issues: MigrationIssue[] = []

	for (const file of files) {
		const full_path = path.join(migrations_dir, file)
		const content = fs.readFileSync(full_path, 'utf-8')
		const issues = check_migration_sql(content, file)
		all_issues.push(...issues)
	}

	return all_issues
}
