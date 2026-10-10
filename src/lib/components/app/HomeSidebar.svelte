<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right'
	import CompassIcon from '@lucide/svelte/icons/compass'
	import FlameIcon from '@lucide/svelte/icons/flame'
	import SearchIcon from '@lucide/svelte/icons/search'
	import SparklesIcon from '@lucide/svelte/icons/sparkles'
	import type { TrendingPeriod, UserListItem } from '$lib/types'
	import { api } from '$lib/api'
	import Avatar from './Avatar.svelte'
	import FollowButton from './FollowButton.svelte'
	import SearchSuggestions from './SearchSuggestions.svelte'
	import { t } from '$lib/i18n'
	import { search_history } from '$lib/search-history.svelte'

	let {
		suggested_users = [],
		trending_topics = [],
	}: {
		suggested_users?: UserListItem[]
		trending_topics?: Array<{ tag: string; count: number } | string>
	} = $props()

	let search_input = $state('')
	let is_focused = $state(false)
	let active_period = $state<TrendingPeriod>('week')
	let topics_override = $state<Array<{ tag: string; count: number }> | null>(null)
	let loading_topics = $state(false)

	let displayed_topics = $derived(topics_override ?? trending_topics)

	async function select_period(p: TrendingPeriod) {
		if (p === active_period) return
		active_period = p
		loading_topics = true
		try {
			const res = await api<{ topics: Array<{ tag: string; count: number }> }>(
				`/api/trending?period=${p}&limit=5`,
			)
			topics_override = res.topics
		} catch {
			// keep previous topics if failed
		} finally {
			loading_topics = false
		}
	}

	function handle_search(event: SubmitEvent) {
		event.preventDefault()
		const q = search_input.trim()
		if (!q) return
		search_history.add(q)
		is_focused = false
		void goto(`${resolve('/explore')}?q=${encodeURIComponent(q)}`)
	}
</script>

<div class="space-y-4">
	<!-- Quick Search Bar (X-like quick discovery) -->
	<div class="relative">
		<form onsubmit={handle_search} role="search" class="relative">
			<SearchIcon
				class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
			/>
			<input
				type="search"
				bind:value={search_input}
				onfocus={() => (is_focused = true)}
				placeholder={$t('sidebar.search_placeholder')}
				class="w-full rounded-full border border-slate-200/80 bg-white/90 py-2.5 pr-4 pl-10 text-xs text-slate-900 shadow-xs transition placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
			/>
		</form>

		{#if is_focused}
			<div
				class="fixed inset-0 z-40"
				role="presentation"
				onclick={() => (is_focused = false)}
			></div>
			<SearchSuggestions
				on_select={(q) => {
					search_input = q
					search_history.add(q)
					is_focused = false
					void goto(`${resolve('/explore')}?q=${encodeURIComponent(q)}`)
				}}
				{trending_topics}
			/>
		{/if}
	</div>

	{#if displayed_topics.length > 0 || topics_override !== null}
		<!-- Trending Now Section -->
		<section
			class="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-xs backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/90"
			aria-labelledby="trending-heading"
		>
			<div class="flex flex-wrap items-center justify-between gap-1.5 pb-2.5">
				<div class="flex items-center gap-1.5">
					<FlameIcon class="size-4 text-orange-500" />
					<h2 id="trending-heading" class="text-sm font-bold tracking-tight text-slate-900">
						{$t('sidebar.trending_now')}
					</h2>
				</div>
				<!-- Period Pills: Today / Week / Month -->
				<div
					class="inline-flex items-center rounded-full bg-slate-100 p-0.5 text-[10px] font-semibold dark:bg-slate-800"
					role="tablist"
					aria-label={$t('sidebar.trending_window')}
				>
					<button
						type="button"
						role="tab"
						aria-selected={active_period === 'today'}
						onclick={() => select_period('today')}
						class="rounded-full px-2 py-0.5 transition {active_period === 'today'
							? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50'
							: 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}"
					>
						{$t('sidebar.today')}
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={active_period === 'week'}
						onclick={() => select_period('week')}
						class="rounded-full px-2 py-0.5 transition {active_period === 'week'
							? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50'
							: 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}"
					>
						{$t('sidebar.week')}
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={active_period === 'month'}
						onclick={() => select_period('month')}
						class="rounded-full px-2 py-0.5 transition {active_period === 'month'
							? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-50'
							: 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}"
					>
						{$t('sidebar.month')}
					</button>
				</div>
			</div>

			<div
				class="divide-y divide-slate-100 transition-opacity dark:divide-slate-800 {loading_topics
					? 'opacity-50'
					: ''}"
			>
				{#if displayed_topics.length === 0}
					<p class="py-3 text-center text-xs text-slate-400">
						{active_period === 'today'
							? $t('sidebar.no_trending_today')
							: active_period === 'week'
								? $t('sidebar.no_trending_week')
								: $t('sidebar.no_trending_month')}
					</p>
				{:else}
					{#each displayed_topics as topic (typeof topic === 'string' ? topic : topic.tag)}
						{@const tag_name = typeof topic === 'string' ? topic : topic.tag}
						{@const post_count = typeof topic === 'string' ? null : topic.count}
						<a
							href={`${resolve('/explore')}?q=${encodeURIComponent('#' + tag_name)}`}
							class="group -mx-2 flex items-center justify-between rounded-2xl p-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
						>
							<div class="min-w-0 flex-1">
								<p
									class="truncate text-xs font-bold text-slate-900 transition group-hover:text-indigo-600 dark:text-slate-100"
								>
									#{tag_name}
								</p>
								{#if post_count}
									<p class="mt-0.5 text-[11px] text-slate-400">
										{$t('sidebar.post_count', { values: { count: post_count } })}
									</p>
								{/if}
							</div>
							<ArrowUpRightIcon
								class="size-3.5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-slate-600 dark:text-slate-600 dark:group-hover:text-slate-300"
							/>
						</a>
					{/each}
				{/if}
			</div>

			<div class="mt-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
				<a
					href={`${resolve('/explore')}?period=${active_period}`}
					class="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 transition hover:text-indigo-700"
				>
					<CompassIcon class="size-3.5" />
					<span>{$t('sidebar.explore_all')}</span>
				</a>
			</div>
		</section>
	{/if}

	<!-- Who to Follow (User Recommendations) -->
	<section
		class="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-xs backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/90"
		aria-labelledby="who-to-follow-heading"
	>
		<div class="flex items-center justify-between pb-2">
			<h2 id="who-to-follow-heading" class="text-sm font-bold tracking-tight text-slate-900">
				{$t('sidebar.who_to_follow')}
			</h2>
			<SparklesIcon class="size-4 text-amber-500" />
		</div>

		{#if suggested_users.length > 0}
			<ul class="divide-y divide-slate-100 dark:divide-slate-800">
				{#each suggested_users.slice(0, 4) as person (person.id)}
					<li class="flex items-center justify-between gap-2 py-2.5">
						<a
							href={resolve('/u/[handle]', { handle: person.handle })}
							class="group flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden"
						>
							<div class="shrink-0"><Avatar user={person} size={34} /></div>
							<div class="min-w-0 flex-1">
								<p
									class="truncate text-xs font-bold text-slate-900 group-hover:underline dark:text-slate-100"
								>
									{person.name}
								</p>
								<p class="truncate text-[11px] text-slate-400 dark:text-slate-500">
									@{person.username ?? person.id.slice(0, 8)}
								</p>
							</div>
						</a>

						<div class="shrink-0">
							<FollowButton
								handle={person.handle}
								following={person.is_following}
								follows_you={Boolean(person.is_followed_by)}
							/>
						</div>
					</li>
				{/each}
			</ul>
		{:else}
			<div class="py-3 text-center text-xs text-slate-400">
				<p>{$t('sidebar.no_suggestions')}</p>
				<a
					href={resolve('/explore')}
					class="mt-1 inline-block font-semibold text-indigo-600 hover:underline"
				>
					{$t('sidebar.discover_on_explore')}
				</a>
			</div>
		{/if}

		<div class="mt-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
			<a
				href={resolve('/explore')}
				class="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 transition hover:text-indigo-700"
			>
				<span>{$t('sidebar.show_more')}</span>
			</a>
		</div>
	</section>

	<!-- Footer Info -->
	<footer class="px-2 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
		<p class="flex flex-wrap gap-x-3 gap-y-1">
			<a href={resolve('/explore')} class="hover:text-slate-600 hover:underline"
				>{$t('nav.explore')}</a
			>
			<span>© 2026 Loop</span>
		</p>
	</footer>
</div>
