<script lang="ts">
	import AppShell from './AppShell.svelte'

	let {
		user,
	}: { user: { id: string; name: string; username?: string | null; onboarded?: boolean } } =
		$props()
</script>

<AppShell {user} title="Test Title">
	<div>Main content</div>
</AppShell>
