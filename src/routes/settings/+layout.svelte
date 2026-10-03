<script lang="ts">
	import { page } from '$app/stores'
	import { resolve } from '$app/paths'
	import UserIcon from '@lucide/svelte/icons/user'
	import ShieldIcon from '@lucide/svelte/icons/shield'
	import AppShell from '$lib/components/app/AppShell.svelte'

	let { data, children } = $props()

	const nav_items = [
		{ href: '/settings/profile', label: 'Profile', icon: UserIcon },
		{ href: '/settings/privacy', label: 'Privacy & Safety', icon: ShieldIcon },
	] as const
</script>

<AppShell user={data.user} title="Settings">
	<div class="py-6 md:py-10">
		<div class="flex flex-col space-y-8 md:flex-row md:space-y-0 md:space-x-8">
			<aside class="md:w-1/4">
				<nav class="flex space-x-2 overflow-x-auto pb-2 md:flex-col md:space-y-1 md:space-x-0 md:pb-0">
					{#each nav_items as item (item.href)}
						<a
							href={resolve(item.href)}
							class="flex items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium transition-colors {$page.url.pathname.startsWith(
								item.href,
							)
								? 'bg-black text-white'
								: 'text-slate-500 hover:bg-slate-100 hover:text-black'}"
						>
							<item.icon class="h-4 w-4" />
							<span>{item.label}</span>
						</a>
					{/each}
				</nav>
			</aside>
			<div class="flex-1 min-w-0">
				{@render children()}
			</div>
		</div>
	</div>
</AppShell>
