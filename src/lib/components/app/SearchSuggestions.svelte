<script lang="ts">
	import ClockIcon from '@lucide/svelte/icons/clock'
	import SearchIcon from '@lucide/svelte/icons/search'
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
</script>

<div
	class="absolute top-full right-0 left-0 z-50 mt-2 rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-xl backdrop-blur-md transition-all duration-150"
	role="listbox"
>
	{#if search_history.items.length > 0}
		<div class="mb-3">
			<div
				class="mb-1.5 flex items-center justify-between px-2 text-xs font-bold tracking-wider text-slate-400 uppercase"
			>
				<span class="flex items-center gap-1">
					<ClockIcon class="size-3.5 text-slate-400" /> Recent searches
				</span>
				<button
					type="button"
					onclick={() => search_history.clear()}
					class="font-semibold text-slate-400 transition hover:text-rose-600"
				>
					Clear all
				</button>
			</div>
			<div class="space-y-0.5">
				{#each search_history.items as query (query)}
					<div
						class="group flex items-center justify-between rounded-xl px-2.5 py-1.5 transition hover:bg-slate-100/80"
					>
						<button
							type="button"
							onclick={() => select_query(query)}
							class="flex flex-1 items-center gap-2.5 text-left text-xs font-semibold text-slate-800"
						>
							<SearchIcon class="size-3.5 text-slate-400 group-hover:text-indigo-600" />
							<span class="truncate">{query}</span>
						</button>
						<button
							type="button"
							aria-label="Remove search"
							onclick={(e) => {
								e.stopPropagation()
								search_history.remove(query)
							}}
							class="p-1 text-slate-400 opacity-60 transition hover:text-slate-700 hover:opacity-100"
						>
							<XIcon class="size-3.5" />
						</button>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if trending_topics.length > 0}
		<div>
			<div class="mb-1.5 px-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
				Popular searches
			</div>
			<div class="space-y-0.5">
				{#each trending_topics.slice(0, 5) as topic (typeof topic === 'string' ? topic : topic.tag)}
					{@const tag = typeof topic === 'string' ? topic : topic.tag}
					<button
						type="button"
						onclick={() => select_query(`#${tag}`)}
						class="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-xs font-semibold text-slate-800 transition hover:bg-slate-100/80"
					>
						<span class="font-bold text-indigo-600">#</span>
						<span class="truncate">#{tag}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
