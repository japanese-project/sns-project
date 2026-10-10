import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import { sveltekit } from '@sveltejs/kit/vite'

export default defineConfig({
	server: {
		port: 5555,
	},
	plugins: [tailwindcss(), sveltekit()],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				// Pre-bundle deps that component tests import, so vite doesn't discover them mid-run
				// and reload (which loads a second Svelte copy and breaks the first run on a cold cache).
				optimizeDeps: {
					include: [
						'@lucide/svelte/icons/x',
						'@lucide/svelte/icons/image',
						'@lucide/svelte/icons/more-horizontal',
						'@lucide/svelte/icons/copy',
						'@lucide/svelte/icons/check',
						'@lucide/svelte/icons/log-out',
						'@lucide/svelte/icons/bot',
						'@lucide/svelte/icons/globe',
						'@lucide/svelte/icons/languages',
						'@lucide/svelte/icons/external-link',
					],
				},
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }],
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
				},
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					// beforeAll spins up a wrangler platform proxy (workerd) and replays every
					// migration against it. That takes well over the 10s default once several
					// files run in parallel, so give the DB setup room.
					hookTimeout: 60_000,
				},
			},
		],
	},
})
