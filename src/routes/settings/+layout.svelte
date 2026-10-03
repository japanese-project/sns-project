<script lang="ts">
	import { page } from '$app/stores'
	import { resolve } from '$app/paths'
	import UserIcon from '@lucide/svelte/icons/user'
	import ShieldIcon from '@lucide/svelte/icons/shield'

	let { children } = $props()

	const nav_items = [
		{ href: '/settings/profile', label: 'Profile', icon: UserIcon },
		{ href: '/settings/privacy', label: 'Privacy & Safety', icon: ShieldIcon },
	] as const
</script>

<div class="container max-w-4xl py-6 md:py-10">
	<div class="flex flex-col space-y-8 lg:flex-row lg:space-y-0 lg:space-x-12">
		<aside class="lg:w-1/4">
			<nav class="flex space-x-2 lg:flex-col lg:space-y-1 lg:space-x-0">
				{#each nav_items as item (item.href)}
					<a
						href={resolve(item.href)}
						class="flex items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium transition-colors {$page.url.pathname.startsWith(
							item.href,
						)
							? 'bg-secondary text-secondary-foreground'
							: 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
					>
						<item.icon class="h-4 w-4" />
						<span>{item.label}</span>
					</a>
				{/each}
			</nav>
		</aside>
		<div class="max-w-2xl flex-1">
			{@render children()}
		</div>
	</div>
</div>
