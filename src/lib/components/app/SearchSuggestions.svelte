<script lang="ts">
	import ClockIcon from '@lucide/svelte/icons/clock'
	import SearchIcon from '@lucide/svelte/icons/search'
	import SparklesIcon from '@lucide/svelte/icons/sparkles'
	import XIcon from '@lucide/svelte/icons/x'
	import { search_history } from '$lib/search-history.svelte'

	let {
		on_select,
		trending_topics = [],
	}: {
		on_select: (query: string) => void
		trending_topics?: Array<{ tag: string } | string>
	} = $props()

	function select_query(q: string) {
		search_history.add(q)
		on_select(q)
	}

	let has_history = $derived(search_history.items.length > 0)
	let has_trending = $derived(trending_topics.length > 0)
</script>

<div
	class="absolute top-full right-0 left-0 z-50 mt-1.5 overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-2 shadow-lg shadow-slate-900/5 backdrop-blur-md transition-all duration-150 dark:border-slate-800 dark:bg-slate-900/95"
	role="listbox"
	data-testid="search-suggestions"
>
	{#if has_history}
		<div class="mb-2">
			<div
				class="flex items-center justify-between px-2.5 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500"
			>
				<span class="flex items-center gap-1.5">
					<ClockIcon class="size-3 text-slate-400" />
					<span>Recent searches</span>
				</span>
				<button
					type="button"
					onclick={() => search_history.clear()}
					class="transition hover:text-slate-700 active:scale-95 dark:hover:text-slate-200"
				>
					Clear all
				</button>
			</div>
			<div class="space-y-0.5">
				{#each search_history.items as query (query)}
					<div
						class="group flex items-center justify-between rounded-xl px-2.5 py-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
					>
						<button
							type="button"
							onclick={() => select_query(query)}
							class="flex flex-1 items-center gap-2.5 text-left text-xs font-semibold text-slate-700 transition group-hover:text-slate-900 dark:text-slate-200 dark:group-hover:text-slate-50"
						>
							<SearchIcon
								class="size-3.5 text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
							/>
							<span class="truncate">{query}</span>
						</button>
						<button
							type="button"
							aria-label="Remove search"
							onclick={(e) => {
								e.stopPropagation()
								search_history.remove(query)
							}}
							class="rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
						>
							<XIcon class="size-3" />
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if has_trending}
		<div>
			<div
				class="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500"
			>
				<SparklesIcon class="size-3 text-slate-400" />
				<span>Popular topics</span>
			</div>
			<div class="space-y-0.5">
				{#each trending_topics.slice(0, 5) as topic (typeof topic === 'string' ? topic : topic.tag)}
					{@const tag = typeof topic === 'string' ? topic : topic.tag}
					<button
						type="button"
						onclick={() => select_query(`#${tag}`)}
						class="group flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 transition group-hover:text-slate-900 hover:bg-slate-100 dark:text-slate-200 dark:group-hover:text-slate-50 dark:hover:bg-slate-800"
					>
						<span class="truncate">#{tag}</span>
						<span class="text-[10px] font-medium text-slate-400">trending</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if !has_history && !has_trending}
		<div class="px-3 py-4 text-center">
			<SearchIcon class="mx-auto size-5 text-slate-300" />
			<p class="mt-1 text-xs text-slate-500">Search for people, keywords, or #topics</p>
		</div>
	{/if}
</div>
