<script lang="ts">
	import { page } from '$app/stores'
	import UserIcon from '@lucide/svelte/icons/user'
	import ShieldIcon from '@lucide/svelte/icons/shield'
	import BellIcon from '@lucide/svelte/icons/bell'
	
	let { children } = $props()

	const navItems = [
		{ href: '/settings/profile', label: 'Profile', icon: UserIcon },
		{ href: '/settings/privacy', label: 'Privacy & Safety', icon: ShieldIcon },
	]
</script>

<div class="container max-w-4xl py-6 md:py-10">
	<div class="flex flex-col space-y-8 lg:flex-row lg:space-y-0 lg:space-x-12">
		<aside class="lg:w-1/4">
			<nav class="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
				{#each navItems as item}
					<a
						href={item.href}
						class="flex items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium transition-colors {$page.url.pathname.startsWith(item.href) ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}"
					>
						<item.icon class="h-4 w-4" />
						<span>{item.label}</span>
					</a>
				{/each}
			</nav>
		</aside>
		<div class="flex-1 max-w-2xl">
			{@render children()}
		</div>
	</div>
</div>
