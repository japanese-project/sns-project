<script lang="ts">
	import GlobeIcon from '@lucide/svelte/icons/globe'
	import UsersIcon from '@lucide/svelte/icons/users'
	import AppShell from '$lib/components/app/AppShell.svelte'
	import HomeSidebar from '$lib/components/app/HomeSidebar.svelte'
	import PostList from '$lib/components/app/PostList.svelte'

	let { data } = $props()

	let tab_override = $state<'following' | 'global' | null>(null)
	let active_tab = $derived(tab_override ?? 'global')

	function set_tab(tab: 'following' | 'global') {
		tab_override = tab
	}

	let endpoint = $derived(
		active_tab === 'global' ? '/api/posts?feed=global' : '/api/posts?feed=following',
	)

	let empty_message = $derived(
		active_tab === 'global'
			? 'No posts yet. Be the first to share something.'
			: "You aren't following anyone yet. Discover people on Explore or switch to the Global feed!",
	)
</script>

<AppShell user={data.user} title="Home">
	{#snippet header_content()}
		<!-- Integrated Global / Following Switcher in Top Pill -->
		<div
			class="inline-flex items-center rounded-full bg-slate-100/90 p-0.5 text-xs font-semibold shadow-inner"
			role="tablist"
			aria-label="Feed selection"
		>
			<button
				type="button"
				role="tab"
				aria-selected={active_tab === 'global'}
				onclick={() => set_tab('global')}
				class="flex items-center gap-1.5 rounded-full px-3 py-1 transition-all duration-200 active:scale-95 {active_tab ===
				'global'
					? 'bg-black font-bold text-white shadow-xs'
					: 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'}"
			>
				<GlobeIcon class="size-3.5" />
				<span>Global</span>
			</button>

			<button
				type="button"
				role="tab"
				aria-selected={active_tab === 'following'}
				onclick={() => set_tab('following')}
				class="flex items-center gap-1.5 rounded-full px-3 py-1 transition-all duration-200 active:scale-95 {active_tab ===
				'following'
					? 'bg-black font-bold text-white shadow-xs'
					: 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'}"
			>
				<UsersIcon class="size-3.5" />
				<span>Following</span>
			</button>
		</div>
	{/snippet}

	{#snippet right_sidebar()}
		<HomeSidebar
			suggested_users={data.suggested_users ?? []}
			trending_topics={data.trending_topics ?? []}
		/>
	{/snippet}

	<!-- Primary Feed -->
	<PostList {endpoint} accepts_new_posts {empty_message} />
</AppShell>
