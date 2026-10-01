<script lang="ts">
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import GlobeIcon from '@lucide/svelte/icons/globe'
	import SparklesIcon from '@lucide/svelte/icons/sparkles'
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
	<div class="mx-auto flex w-full max-w-5xl items-start justify-center gap-8">
		<!-- Main Stream -->
		<div class="w-full max-w-2xl min-w-0 flex-1">
			<!-- Integrated Feed Header & Tab Switcher -->
			<div
				class="mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-xs"
			>
				<div
					class="flex border-b border-slate-200/80 text-sm font-semibold"
					role="tablist"
					aria-label="Feed selection"
				>
					<button
						type="button"
						role="tab"
						aria-selected={active_tab === 'following'}
						onclick={() => set_tab('following')}
						class="relative flex flex-1 items-center justify-center gap-2 py-3.5 transition {active_tab ===
						'following'
							? 'font-bold text-slate-900'
							: 'text-slate-500 hover:text-slate-800'}"
					>
						<UsersIcon
							class="size-4 {active_tab === 'following' ? 'text-black' : 'text-slate-400'}"
						/>
						Following
						{#if active_tab === 'following'}
							<span class="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-black"></span>
						{/if}
					</button>

					<button
						type="button"
						role="tab"
						aria-selected={active_tab === 'global'}
						onclick={() => set_tab('global')}
						class="relative flex flex-1 items-center justify-center gap-2 py-3.5 transition {active_tab ===
						'global'
							? 'font-bold text-slate-900'
							: 'text-slate-500 hover:text-slate-800'}"
					>
						<GlobeIcon class="size-4 {active_tab === 'global' ? 'text-black' : 'text-slate-400'}" />
						Global
						{#if active_tab === 'global'}
							<span class="absolute inset-x-6 bottom-0 h-0.5 rounded-full bg-black"></span>
						{/if}
					</button>
				</div>

				<!-- Subtle Feed Context Bar -->
				<div
					class="flex items-center justify-between bg-slate-50/70 px-4 py-2 text-xs text-slate-500"
				>
					{#if active_tab === 'following'}
						<span>Posts from accounts you follow</span>
						{#if !signed_in}
							<a href={resolve('/login')} class="font-semibold text-slate-800 hover:underline">
								Sign in
							</a>
						{/if}
					{:else}
						<span>Recent public posts across the network</span>
						<a
							href={resolve('/explore')}
							class="flex items-center gap-1 font-semibold text-slate-800 hover:underline"
						>
							<SparklesIcon class="size-3" /> Explore more
						</a>
					{/if}
				</div>
			</div>

			<!-- Posts stream -->
			<PostList {endpoint} {signed_in} accepts_new_posts={signed_in} {empty_message} />
		</div>

		<!-- Right-side Discovery Sidebar (Visible on xl screens and above) -->
		<aside class="sticky top-20 hidden w-72 shrink-0 lg:w-80 xl:block">
			<HomeSidebar suggested_users={data.suggested_users} {signed_in} />
		</aside>
	</div>
</AppShell>
