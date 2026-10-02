<script lang="ts">
	// Test-only stand-in for AppShell: renders just the page content, without the nav, auth
	// client or notification polling that the real shell pulls in.
	import type { Snippet } from 'svelte'

	let { children }: { children?: Snippet } = $props()
</script>

{@render children?.()}
