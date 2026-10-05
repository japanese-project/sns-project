<script lang="ts">
	import CompassIcon from '@lucide/svelte/icons/compass'
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid'
	import ListIcon from '@lucide/svelte/icons/list'
	import SearchIcon from '@lucide/svelte/icons/search'
	import SparklesIcon from '@lucide/svelte/icons/sparkles'
	import XIcon from '@lucide/svelte/icons/x'
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import AppShell from '$lib/components/app/AppShell.svelte'
	import ExplorePinCard from '$lib/components/app/ExplorePinCard.svelte'
	import PostCard from '$lib/components/app/PostCard.svelte'
	import UserCard from '$lib/components/app/UserCard.svelte'
	import { api } from '$lib/api'
	import { MAX_SEARCH_LENGTH } from '$lib/limits'
	import SearchSuggestions from '$lib/components/app/SearchSuggestions.svelte'
	import { search_history } from '$lib/search-history.svelte'
	import type { Page, PostView, TrendingPeriod } from '$lib/types'

	let { data } = $props()

	let input = $state('')
	let is_focused = $state(false)
	let view_mode = $state<'masonry' | 'feed'>('masonry')

	// Reset local paging state whenever a new search result set arrives.
	let extra_posts = $state<PostView[]>([])
	let next_cursor = $state<string | null>(null)
	let loading_more = $state(false)
	let more_error = $state<string | null>(null)

	$effect(() => {
		input = data.query
		extra_posts = []
		next_cursor = data.results?.next_cursor ?? null
	})

	let posts = $derived([...(data.results?.posts ?? []), ...extra_posts])

	const period_labels: Record<TrendingPeriod, string> = {
		today: 'Today',
		week: 'This Week',
		month: 'This Month',
	}

	function set_period(period: TrendingPeriod) {
		const path = resolve('/explore')
		is_focused = false
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(`${path}?period=${period}` as `/${string}`)
	}

	function search_for(q: string) {
		const trimmed = q.trim()
		if (trimmed) search_history.add(trimmed)
		is_focused = false
		const path = resolve('/explore')
		const destination = trimmed ? `${path}?q=${encodeURIComponent(trimmed)}` : path
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(destination as `/${string}`)
	}

	function submit(event: SubmitEvent) {
		event.preventDefault()
		search_for(input)
	}

	async function load_more() {
		if (!next_cursor || loading_more) return
		loading_more = true
		more_error = null
		try {
			const page = await api<Page<PostView> & { posts?: PostView[] }>(
				`/api/search?q=${encodeURIComponent(data.query)}&cursor=${encodeURIComponent(next_cursor)}`,
			)
			const result = page as unknown as { posts: PostView[]; next_cursor: string | null }
			extra_posts = [...extra_posts, ...result.posts]
			next_cursor = result.next_cursor
		} catch (e) {
			more_error = e instanceof Error ? e.message : 'Could not load more results'
		} finally {
			loading_more = false
		}
	}
</script>

<AppShell user={data.user} title="Explore" layout="wide">
	<div class="mx-auto w-full space-y-5">
		<!-- Top Bar: Search Input with Suggestions dropdown -->
		<div class="relative mx-auto max-w-3xl">
			<form onsubmit={submit} role="search" class="relative">
				<SearchIcon
					class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400"
				/>
				<input
					type="search"
					bind:value={input}
					onfocus={() => (is_focused = true)}
					maxlength={MAX_SEARCH_LENGTH}
					placeholder="Search people, tags, or topics…"
					aria-label="Search"
					class="w-full rounded-2xl border border-slate-200/80 bg-white py-2.5 pr-9 pl-10 text-sm text-slate-900 shadow-xs transition outline-none placeholder:text-slate-400 focus:border-black focus:ring-1 focus:ring-black [&::-webkit-search-cancel-button]:appearance-none"
				/>
				{#if input}
					<button
						type="button"
						aria-label="Clear search"
						onclick={() => {
							input = ''
							if (data.results) {
								search_for('')
							}
						}}
						class="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
					>
						<XIcon class="size-3.5" />
					</button>
				{/if}
			</form>

			{#if is_focused}
				<div
					class="fixed inset-0 z-40"
					role="presentation"
					onclick={() => (is_focused = false)}
				></div>
				<SearchSuggestions
					on_select={(q) => {
						input = q
						search_for(q)
					}}
					trending_topics={data.discovery?.topics ?? []}
				/>
			{/if}
		</div>

		{#if data.error}
			<p class="mx-auto max-w-2xl rounded-2xl bg-rose-50 p-4 text-sm text-rose-700" role="alert">
				{data.error}
			</p>
		{:else if !data.results && data.discovery}
			<!-- ───────────────────────────────────────────────────────────── -->
			<!-- DISCOVERY MODE: PINTEREST / INSTAGRAM SEARCH ALIGNMENT        -->
			<!-- ───────────────────────────────────────────────────────────── -->

			<!-- Sleek Horizontal Topic & Time Window Strip (No vertical stacking boxes!) -->
			<div class="custom-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
				<!-- Time Window Tabs: Today / Week / Month -->
				<div
					class="inline-flex shrink-0 items-center rounded-full bg-slate-100 p-0.5 text-xs font-medium"
					role="tablist"
					aria-label="Trending time window"
				>
					{#each ['today', 'week', 'month'] as const as p (p)}
						<button
							type="button"
							role="tab"
							aria-selected={data.period === p}
							onclick={() => set_period(p)}
							class="rounded-full px-2.5 py-1 text-[11px] font-semibold transition {data.period ===
							p
								? 'bg-white text-slate-900 shadow-xs'
								: 'text-slate-500 hover:text-slate-900'}"
						>
							{period_labels[p]}
						</button>
					{/each}
				</div>

				<div class="h-4 w-px shrink-0 bg-slate-200"></div>

				<!-- Trending Topic Chips -->
				{#each data.discovery.topics as item (typeof item === 'string' ? item : item.tag)}
					{@const tag_name = typeof item === 'string' ? item : item.tag}
					{@const post_count = typeof item === 'string' ? null : item.count}
					<button
						type="button"
						onclick={() => search_for(`#${tag_name}`)}
						class="group flex shrink-0 items-center gap-1 rounded-full border border-slate-200/80 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
					>
						<span class="text-indigo-600">#</span>
						<span>{tag_name}</span>
						{#if post_count && post_count > 1}
							<span
								class="py-0.2 rounded-full bg-slate-100 px-1.5 text-[10px] font-normal text-slate-500"
							>
								{post_count}
							</span>
						{/if}
					</button>
				{/each}
			</div>

			<!-- Compact Suggested Creators Carousel -->
			{#if data.discovery.suggested_users.length > 0}
				<div class="space-y-2">
					<div class="flex items-center justify-between px-1 text-slate-700">
						<div class="flex items-center gap-1.5">
							<SparklesIcon class="size-3.5 text-amber-500" />
							<span class="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
								Suggested Creators
							</span>
						</div>
					</div>

					<div class="custom-scrollbar flex gap-3 overflow-x-auto pb-1">
						{#each data.discovery.suggested_users as person (person.id)}
							<UserCard {person} />
						{/each}
					</div>
				</div>
			{/if}

			<!-- Pinterest / Instagram Style Multi-Column Grid Header & Content -->
			<div class="space-y-3 pt-1">
				<div class="flex items-center justify-between px-1 text-slate-700">
					<div class="flex items-center gap-2">
						<CompassIcon class="size-4 text-indigo-600" />
						<h2 class="text-xs font-bold tracking-wider text-slate-500 uppercase">
							Explore Content ({data.discovery.posts.length})
						</h2>
					</div>

					<!-- View Mode Switch: Masonry Grid vs Single Feed -->
					<div class="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
						<button
							type="button"
							onclick={() => (view_mode = 'masonry')}
							class="rounded-lg p-1.5 transition {view_mode === 'masonry'
								? 'bg-white text-slate-900 shadow-2xs'
								: 'text-slate-400 hover:text-slate-700'}"
							title="Pinterest / Instagram Masonry Grid"
							aria-label="Masonry Grid View"
						>
							<LayoutGridIcon class="size-3.5" />
						</button>
						<button
							type="button"
							onclick={() => (view_mode = 'feed')}
							class="rounded-lg p-1.5 transition {view_mode === 'feed'
								? 'bg-white text-slate-900 shadow-2xs'
								: 'text-slate-400 hover:text-slate-700'}"
							title="Standard Single Feed"
							aria-label="Feed View"
						>
							<ListIcon class="size-3.5" />
						</button>
					</div>
				</div>

				{#if view_mode === 'masonry'}
					<!-- Responsive Pinterest / Instagram Multi-Column Grid (2 cols on mobile, up to 5 on wide) -->
					<div
						class="columns-2 gap-2.5 [column-fill:_balance] sm:columns-3 sm:gap-3.5 lg:columns-4 xl:columns-5"
					>
						{#each data.discovery.posts as post (post.id)}
							<ExplorePinCard {post} />
						{/each}
					</div>
				{:else}
					<!-- Classic Single-Column Stream -->
					<div class="mx-auto max-w-2xl space-y-6">
						{#each data.discovery.posts as post (post.id)}
							<PostCard {post} />
						{/each}
					</div>
				{/if}
			</div>
		{:else if data.results}
			<!-- ───────────────────────────────────────────────────────────── -->
			<!-- SEARCH RESULTS MODE (MULTI-COLUMN ALIGNMENT)                  -->
			<!-- ───────────────────────────────────────────────────────────── -->

			<!-- Matching People Carousel -->
			{#if data.results.users.length > 0}
				<div class="space-y-2">
					<h3 class="px-1 text-xs font-bold tracking-wider text-slate-500 uppercase">
						People Matching “{data.query}” ({data.results.users.length})
					</h3>
					<div class="custom-scrollbar flex gap-3 overflow-x-auto pb-1">
						{#each data.results.users as person (person.id)}
							<UserCard {person} />
						{/each}
					</div>
				</div>
			{/if}

			<!-- Matching Posts in Pinterest / Instagram Multi-Column Grid -->
			<div class="space-y-3 pt-2">
				<div class="flex items-center justify-between px-1 text-slate-700">
					<h2 class="text-xs font-bold tracking-wider text-slate-500 uppercase">
						Posts Matching “{data.query}” ({posts.length})
					</h2>

					<!-- View Mode Switch -->
					<div class="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
						<button
							type="button"
							onclick={() => (view_mode = 'masonry')}
							class="rounded-lg p-1.5 transition {view_mode === 'masonry'
								? 'bg-white text-slate-900 shadow-2xs'
								: 'text-slate-400 hover:text-slate-700'}"
							title="Pinterest / Instagram Masonry Grid"
							aria-label="Masonry Grid View"
						>
							<LayoutGridIcon class="size-3.5" />
						</button>
						<button
							type="button"
							onclick={() => (view_mode = 'feed')}
							class="rounded-lg p-1.5 transition {view_mode === 'feed'
								? 'bg-white text-slate-900 shadow-2xs'
								: 'text-slate-400 hover:text-slate-700'}"
							title="Standard Single Feed"
							aria-label="Feed View"
						>
							<ListIcon class="size-3.5" />
						</button>
					</div>
				</div>

				{#if posts.length === 0}
					<div
						class="rounded-2xl border border-slate-200/60 bg-white p-8 text-center text-sm text-slate-500"
					>
						No posts match “{data.query}”.
					</div>
				{:else if view_mode === 'masonry'}
					<div
						class="columns-2 gap-2.5 [column-fill:_balance] sm:columns-3 sm:gap-3.5 lg:columns-4 xl:columns-5"
					>
						{#each posts as post (post.id)}
							<ExplorePinCard {post} />
						{/each}
					</div>
				{:else}
					<div class="mx-auto max-w-2xl space-y-6">
						{#each posts as post (post.id)}
							<PostCard {post} />
						{/each}
					</div>
				{/if}

				<!-- Cursor Paginated Load More Button -->
				{#if next_cursor}
					<div class="pt-4 pb-8 text-center">
						<button
							type="button"
							onclick={load_more}
							disabled={loading_more}
							class="rounded-full border border-slate-200 bg-white px-6 py-2.5 text-xs font-bold text-slate-800 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
						>
							{loading_more ? 'Loading more content…' : 'Load more results'}
						</button>
						{#if more_error}
							<p class="mt-2 text-xs text-rose-600">{more_error}</p>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</AppShell>
