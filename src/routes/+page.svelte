<script lang="ts">
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import GlobeIcon from '@lucide/svelte/icons/globe'
	import UsersIcon from '@lucide/svelte/icons/users'
	import AppShell from '$lib/components/app/AppShell.svelte'
	import HomeSidebar from '$lib/components/app/HomeSidebar.svelte'
	import PostList from '$lib/components/app/PostList.svelte'

	let { data } = $props()

	let signed_in = $derived(data.user !== null)
	let tab_override = $state<'following' | 'global' | null>(null)
	let active_tab = $derived(tab_override ?? (data.user ? 'following' : 'global'))

	function set_tab(tab: 'following' | 'global') {
		if (tab === 'following' && !signed_in) {
			void goto(resolve('/login'))
			return
		}
		tab_override = tab
	}

	let endpoint = $derived(
		active_tab === 'following' ? '/api/posts?feed=following' : '/api/posts?feed=global',
	)

	let empty_message = $derived(
		active_tab === 'following'
			? "You aren't following anyone yet. Discover people on Explore or switch to the Global feed!"
			: 'No posts yet. Be the first to share something.',
	)
</script>

<AppShell user={data.user} title="Home">
	{#snippet header_content()}
		<!-- Integrated Following / Global Switcher in Top Pill -->
		<div
			class="inline-flex items-center rounded-full bg-slate-100 p-0.5 text-xs font-semibold"
			role="tablist"
			aria-label="Feed selection"
		>
			<button
				type="button"
				role="tab"
				aria-selected={active_tab === 'following'}
				onclick={() => set_tab('following')}
				class="flex items-center gap-1 rounded-full px-3 py-1 transition {active_tab === 'following'
					? 'bg-black font-bold text-white shadow-xs'
					: 'text-slate-600 hover:text-slate-900'}"
			>
				<UsersIcon class="size-3" />
				<span>Following</span>
			</button>

			<button
				type="button"
				role="tab"
				aria-selected={active_tab === 'global'}
				onclick={() => set_tab('global')}
				class="flex items-center gap-1 rounded-full px-3 py-1 transition {active_tab === 'global'
					? 'bg-black font-bold text-white shadow-xs'
					: 'text-slate-600 hover:text-slate-900'}"
			>
				<GlobeIcon class="size-3" />
				<span>Global</span>
			</button>
		</div>
	{/snippet}

	<div class="mx-auto flex w-full max-w-5xl items-start justify-center gap-8">
		<!-- Primary Feed Stream -->
		<div class="w-full max-w-2xl min-w-0 flex-1">
			<!-- Posts stream starts immediately below header -->
			<PostList {endpoint} {signed_in} accepts_new_posts={signed_in} {empty_message} />
		</div>

		<!-- Right-side Discovery Sidebar (X-like UX: search, topics, who to follow) -->
		{#if data.suggested_users && data.suggested_users.length > 0}
			<aside class="sticky top-20 hidden w-72 shrink-0 xl:block">
				<HomeSidebar suggested_users={data.suggested_users} {signed_in} />
			</aside>
		{/if}
	</div>
</AppShell>
