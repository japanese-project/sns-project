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
			? "You aren't following anyone yet. Discover people on Explore or check out the Global feed!"
			: 'No posts yet. Be the first to share something.',
	)
</script>

<AppShell user={data.user} title="Home">
	<div class="lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8 xl:grid-cols-[1fr_360px]">
		<main class="min-w-0">
			<!-- Feed switcher -->
			<div class="mb-6 flex justify-center sm:justify-start">
				<div
					class="inline-flex rounded-full bg-white/80 p-1 shadow-sm ring-1 ring-slate-200/80 backdrop-blur"
					role="tablist"
					aria-label="Feed selection"
				>
					<button
						type="button"
						role="tab"
						aria-selected={active_tab === 'following'}
						onclick={() => set_tab('following')}
						class="flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition {active_tab ===
						'following'
							? 'bg-black text-white shadow-sm'
							: 'text-slate-600 hover:text-slate-900'}"
					>
						<UsersIcon class="size-3.5" />
						Following
					</button>

					<button
						type="button"
						role="tab"
						aria-selected={active_tab === 'global'}
						onclick={() => set_tab('global')}
						class="flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition {active_tab ===
						'global'
							? 'bg-black text-white shadow-sm'
							: 'text-slate-600 hover:text-slate-900'}"
					>
						<GlobeIcon class="size-3.5" />
						Global
					</button>
				</div>
			</div>

			<!-- Posts stream -->
			<PostList {endpoint} {signed_in} accepts_new_posts={signed_in} {empty_message} />
		</main>

		<!-- Right-side Discovery Sidebar -->
		<aside class="sticky top-24 hidden lg:block">
			<HomeSidebar suggested_users={data.suggested_users} {signed_in} />
		</aside>
	</div>
</AppShell>
