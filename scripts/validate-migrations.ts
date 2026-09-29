import path from 'node:path'
import { validate_all_migrations } from '../src/lib/server/db/validate-migrations.ts'

function run() {
	const migrations_dir = path.resolve(process.cwd(), 'src/lib/server/db/migrations')
	const issues = validate_all_migrations(migrations_dir)

	if (issues.length > 0) {
		console.error('\n❌ Incompatible migration(s) detected!\n')
		console.error(
			'The project requires non-destructive, backward-compatible migrations (Expand-Contract pattern)',
		)
		console.error(
			'because production deployments and shared PR previews run zero-downtime migrations.\n',
		)
		for (const issue of issues) {
			console.error(`- [${issue.file}:${issue.line}] ${issue.statement}`)
			console.error(`  Reason: ${issue.reason}\n`)
		}
		console.error(
			'If this breaking migration is intended and planned, add `-- allow-destructive-migration: <reason>` to bypass.\n',
		)
		process.exit(1)
	}

	console.log('✅ All database migrations verified: 100% backward-compatible.')
}

run()
