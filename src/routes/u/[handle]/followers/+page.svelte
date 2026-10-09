<script lang="ts">
	import UserList from '$lib/components/app/UserList.svelte'
	import AppShell from '$lib/components/app/AppShell.svelte'
	import { t } from '$lib/i18n'

	let { data } = $props()
</script>

<AppShell user={data.user} title={$t('profile.followers')}>
	<UserList owner={data.owner} kind="followers" />
</AppShell>
