<script lang="ts">
	import UserList from '$lib/components/app/UserList.svelte'
	import AppShell from '$lib/components/app/AppShell.svelte'

	let { data } = $props()
</script>

<AppShell user={data.user} title="Following">
	<UserList owner={data.owner} kind="following" signed_in={data.user !== null} />
</AppShell>
