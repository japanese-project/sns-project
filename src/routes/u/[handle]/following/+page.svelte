<script lang="ts">
	import UserList from '$lib/components/app/UserList.svelte'
	import AppShell from '$lib/components/app/AppShell.svelte'
	import { t } from '$lib/i18n'

	let { data } = $props()
</script>

<AppShell user={data.user} title={$t('profile.following')}>
	<UserList owner={data.owner} kind="following" />
</AppShell>
