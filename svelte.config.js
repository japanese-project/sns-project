import adapter from '@sveltejs/adapter-cloudflare'

const cloudflare = adapter()

// The Cloudflare adapter's dev `emulate()` boots a wrangler platform proxy (miniflare
// spawning workerd) the moment vite's dev server starts, and nothing ever disposes it.
// Under vitest that leaves the process alive after the run, so vitest has to be
// SIGKILLed after its teardown timeout. No test reads platform.env — the server tests
// build their own proxy via $lib/server/services/test-db — so drop `emulate` there.
const test_adapter = { ...cloudflare, emulate: undefined }

export default {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true),
	},
	kit: {
		adapter: process.env.VITEST ? test_adapter : cloudflare,
	},
}
