<script lang="ts">
	import CompassIcon from '@lucide/svelte/icons/compass'
	import SearchIcon from '@lucide/svelte/icons/search'
	import SparklesIcon from '@lucide/svelte/icons/sparkles'
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up'
	import XIcon from '@lucide/svelte/icons/x'
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import AppShell from '$lib/components/app/AppShell.svelte'
	import PostCard from '$lib/components/app/PostCard.svelte'
	import UserRow from '$lib/components/app/UserRow.svelte'
	import { api } from '$lib/api'
	import { MAX_SEARCH_LENGTH } from '$lib/limits'
	import SearchSuggestions from '$lib/components/app/SearchSuggestions.svelte'
	import { search_history } from '$lib/search-history.svelte'
	import type { Page, PostView, TrendingPeriod } from '$lib/types'

	let { data } = $props()

	let input = $state('')
	let is_focused = $state(false)
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

<AppShell user={data.user} title="Explore">
	<div class="mx-auto w-full max-w-2xl">
		<div class="relative">
			<form onsubmit={submit} role="search" class="relative">
				<SearchIcon
					class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400"
				/>
				<input
					type="search"
					bind:value={input}
					onfocus={() => (is_focused = true)}
					maxlength={MAX_SEARCH_LENGTH}
					placeholder="Search people or posts…"
					aria-label="Search"
					class="w-full rounded-2xl border border-slate-200/80 bg-white py-2.5 pr-9 pl-10 text-sm text-slate-900 shadow-xs transition outline-none placeholder:text-slate-400 focus:border-black focus:ring-1 focus:ring-black"
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

		<div class="mt-6 space-y-6">
			{#if data.error}
				<p class="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700" role="alert">{data.error}</p>
			{:else if !data.results && data.discovery}
				<!-- Discovery Mode: Interests / Topics -->
				<section aria-labelledby="topics-heading">
					<div class="mb-3 flex flex-wrap items-center justify-between gap-2 px-1 text-slate-700">
						<div class="flex items-center gap-2">
							<TrendingUpIcon class="size-4 text-indigo-600" />
							<h2
								id="topics-heading"
								class="text-xs font-bold tracking-wider text-slate-500 uppercase"
							>
								Explore Topics
							</h2>
						</div>

						<!-- Time Window Tabs: Today / Week / Month -->
						<div
							class="inline-flex items-center rounded-full bg-slate-100 p-0.5 text-xs font-medium"
							role="tablist"
							aria-label="Trending time window"
						>
							{#each ['today', 'week', 'month'] as const as p (p)}
								<button
									type="button"
									role="tab"
									aria-selected={data.period === p}
									onclick={() => set_period(p)}
									class="rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition {data.period ===
									p
										? 'bg-white text-slate-900 shadow-xs'
										: 'text-slate-500 hover:text-slate-900'}"
								>
									{period_labels[p]}
								</button>
							{/each}
						</div>
					</div>
					{#if data.discovery.topics.length === 0}
						<p class="px-1 text-xs text-slate-400">
							No trending topics found for {period_labels[data.period ?? 'week'].toLowerCase()}.
						</p>
					{:else}
						<div class="flex flex-wrap gap-2">
							{#each data.discovery.topics as item (typeof item === 'string' ? item : item.tag)}
								{@const tag_name = typeof item === 'string' ? item : item.tag}
								{@const post_count = typeof item === 'string' ? null : item.count}
								<button
									type="button"
									onclick={() => search_for(`#${tag_name}`)}
									class="group flex items-baseline gap-1.5 rounded-full border border-slate-200/80 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
								>
									<span>#{tag_name}</span>
									{#if post_count && post_count > 1}
										<span class="text-[11px] font-normal text-slate-400 group-hover:text-slate-500">
											{post_count}
										</span>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</section>

				<!-- Discovery Mode: Suggested People -->
				{#if data.discovery.suggested_users.length > 0}
					<section aria-labelledby="suggested-heading">
						<div class="mb-3 flex items-center gap-2 px-1 text-slate-700">
							<SparklesIcon class="size-4 text-amber-500" />
							<h2
								id="suggested-heading"
								class="text-xs font-bold tracking-wider text-slate-500 uppercase"
							>
								People to Discover
							</h2>
						</div>
						<ul class="divide-y divide-slate-100">
							{#each data.discovery.suggested_users as person (person.id)}
								<UserRow {person} />
							{/each}
						</ul>
					</section>
				{/if}

				<!-- Discovery Mode: Recent / Popular Posts -->
				{#if data.discovery.posts.length > 0}
					<section aria-labelledby="recent-heading">
						<div class="mb-3 flex items-center gap-2 px-1 text-slate-700">
							<CompassIcon class="size-4 text-indigo-600" />
							<h2
								id="recent-heading"
								class="text-xs font-bold tracking-wider text-slate-500 uppercase"
							>
								Recent Discussions
							</h2>
						</div>
						<div class="space-y-10">
							{#each data.discovery.posts as post (post.id)}
								<PostCard {post} />
							{/each}
						</div>
					</section>
				{/if}
			{:else if data.results}
				<!-- Search Results Mode -->
				<section aria-labelledby="people-heading">
					<h2
						id="people-heading"
						class="mb-3 px-1 text-xs font-bold tracking-wider text-slate-500 uppercase"
					>
						People
					</h2>
					{#if data.results.users.length === 0}
						<p class="px-2 text-sm text-slate-500">No people match “{data.query}”.</p>
					{:else}
						<ul class="divide-y divide-slate-100">
							{#each data.results.users as person (person.id)}
								<UserRow {person} />
							{/each}
						</ul>
					{/if}
				</section>

				<section aria-labelledby="posts-heading">
					<h2
						id="posts-heading"
						class="mb-3 px-1 text-xs font-bold tracking-wider text-slate-500 uppercase"
					>
						Posts
					</h2>
					{#if posts.length === 0}
						<p class="px-2 text-sm text-slate-500">No posts match “{data.query}”.</p>
					{:else}
						<div class="space-y-10">
							{#each posts as post (post.id)}
								<PostCard
									{post}
									on_deleted={(id) => (extra_posts = extra_posts.filter((p) => p.id !== id))}
								/>
							{/each}
						</div>
						{#if more_error}<p class="mt-3 text-center text-sm text-rose-600" role="alert">
								{more_error}
							</p>{/if}
						{#if next_cursor}
							<div class="mt-6 flex justify-center">
								<button
									type="button"
									onclick={load_more}
									disabled={loading_more}
									class="rounded-full border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:opacity-60"
								>
									{loading_more ? 'Loading…' : 'Load more'}
								</button>
							</div>
						{/if}
					{/if}
				</section>
			{/if}
		</div>
	</div>
</AppShell>
