<script lang="ts">
	import { page } from '$app/stores'
	import { resolve } from '$app/paths'
	import ShieldIcon from '@lucide/svelte/icons/shield'
	import AppShell from '$lib/components/app/AppShell.svelte'
	import { t } from '$lib/i18n'

	let { data, children } = $props()

	const nav_items = [
		{ href: '/settings/privacy', label_key: 'settings.privacy_label', icon: ShieldIcon },
	] as const
</script>

<AppShell user={data.user} title={$t('settings.title')}>
	<div class="py-6 md:py-10">
		<div class="flex flex-col space-y-8 md:flex-row md:space-y-0 md:space-x-8">
			<aside class="md:w-1/4">
				<nav
					class="flex space-x-2 overflow-x-auto pb-2 md:flex-col md:space-y-1 md:space-x-0 md:pb-0"
				>
					{#each nav_items as item (item.href)}
						<a
							href={resolve(item.href)}
							class="flex items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium transition-colors {$page.url.pathname.startsWith(
								item.href,
							)
								? 'bg-black text-white dark:bg-white dark:text-black'
								: 'text-slate-500 hover:bg-slate-100 hover:text-black dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'}"
						>
							<item.icon class="h-4 w-4" />
							<span>{$t(item.label_key)}</span>
						</a>
					{/each}
				</nav>
			</aside>
			<div class="min-w-0 flex-1">
				{@render children()}
			</div>
		</div>
	</div>
</AppShell>
