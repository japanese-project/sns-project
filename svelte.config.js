import adapter from '@sveltejs/adapter-cloudflare'

export default {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true),
		experimental: {
			async: true, // required for remote functions
		},
	},
	kit: {
		adapter: adapter(),
		experimental: {
			remoteFunctions: true, // required for remote functions
		},
	},
}
