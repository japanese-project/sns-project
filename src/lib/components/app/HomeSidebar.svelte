<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import CompassIcon from '@lucide/svelte/icons/compass'
	import SearchIcon from '@lucide/svelte/icons/search'
	import SparklesIcon from '@lucide/svelte/icons/sparkles'
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up'
	import type { UserListItem } from '$lib/types'
	import Avatar from './Avatar.svelte'
	import FollowButton from './FollowButton.svelte'

	let {
		suggested_users = [],
		signed_in = false,
	}: {
		suggested_users: UserListItem[]
		signed_in: boolean
	} = $props()

	let search_input = $state('')

	function handle_search(event: SubmitEvent) {
		event.preventDefault()
		const q = search_input.trim()
		if (!q) return
		void goto(`${resolve('/explore')}?q=${encodeURIComponent(q)}`)
	}

	const discovery_topics = [
		{ name: 'Technology', category: 'Trending in Tech' },
		{ name: 'Design', category: 'UI & Systems' },
		{ name: 'WebDev', category: 'Software Engineering' },
		{ name: 'OpenSource', category: 'Developer Community' },
		{ name: 'Photography', category: 'Visual Arts' },
	]
</script>

<div class="space-y-4">
	<!-- Quick Search Bar (X-like quick discovery) -->
	<form onsubmit={handle_search} role="search" class="relative">
		<SearchIcon
			class="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400"
		/>
		<input
			type="search"
			bind:value={search_input}
			placeholder="Search Loop…"
			class="w-full rounded-full border border-slate-200/80 bg-white/90 py-2.5 pr-4 pl-10 text-xs text-slate-900 shadow-xs transition placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900 focus:outline-none"
		/>
	</form>

	<!-- Explore Topics (X-like topic stream with clean Loop design tokens) -->
	<section
		class="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-xs backdrop-blur-xs"
		aria-labelledby="topics-heading"
	>
		<div class="flex items-center justify-between pb-2">
			<h2 id="topics-heading" class="text-sm font-bold tracking-tight text-slate-900">
				Explore Topics
			</h2>
			<TrendingUpIcon class="size-4 text-slate-400" />
		</div>

		<div class="divide-y divide-slate-100">
			{#each discovery_topics as topic (topic.name)}
				<a
					href={`${resolve('/explore')}?q=${encodeURIComponent(topic.name)}`}
					class="group -mx-2 flex items-center justify-between rounded-xl px-2 py-2.5 transition hover:bg-slate-50"
				>
					<div class="min-w-0 flex-1">
						<p class="text-[11px] font-medium text-slate-400">{topic.category}</p>
						<p
							class="truncate text-xs font-bold text-slate-800 transition group-hover:text-indigo-600"
						>
							#{topic.name}
						</p>
					</div>
					<span
						class="text-xs text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-600"
					>
						→
					</span>
				</a>
			{/each}
		</div>

		<div class="mt-2 border-t border-slate-100 pt-2.5">
			<a
				href={resolve('/explore')}
				class="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 transition hover:text-indigo-700"
			>
				<CompassIcon class="size-3.5" />
				<span>Show more topics</span>
			</a>
		</div>
	</section>

	<!-- Who to Follow (X-like user recommendations) -->
	{#if suggested_users.length > 0}
		<section
			class="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-xs backdrop-blur-xs"
			aria-labelledby="who-to-follow-heading"
		>
			<div class="flex items-center justify-between pb-2">
				<h2 id="who-to-follow-heading" class="text-sm font-bold tracking-tight text-slate-900">
					Who to Follow
				</h2>
				<SparklesIcon class="size-4 text-amber-500" />
			</div>

			<ul class="divide-y divide-slate-100">
				{#each suggested_users.slice(0, 4) as person (person.id)}
					<li class="flex items-center justify-between gap-2 py-2.5">
						<a
							href={resolve('/u/[handle]', { handle: person.handle })}
							class="group flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden"
						>
							<div class="shrink-0"><Avatar user={person} size={34} /></div>
							<div class="min-w-0 flex-1">
								<p class="truncate text-xs font-bold text-slate-900 group-hover:underline">
									{person.name}
								</p>
								<p class="truncate text-[11px] text-slate-400">
									@{person.username ?? person.id.slice(0, 8)}
								</p>
							</div>
						</a>

						<div class="shrink-0">
							<FollowButton
								handle={person.handle}
								following={person.is_following}
								follows_you={Boolean(person.is_followed_by)}
								{signed_in}
							/>
						</div>
					</li>
				{/each}
			</ul>

			<div class="mt-2 border-t border-slate-100 pt-2.5">
				<a
					href={resolve('/explore')}
					class="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 transition hover:text-indigo-700"
				>
					<span>Show more</span>
				</a>
			</div>
		</section>
	{/if}

	<!-- Quiet footer info -->
	<footer class="px-2 text-[11px] leading-relaxed text-slate-400">
		<p class="flex flex-wrap gap-x-3 gap-y-1">
			<a href={resolve('/explore')} class="hover:text-slate-600 hover:underline">Explore</a>
			<a href={resolve('/login')} class="hover:text-slate-600 hover:underline">About</a>
			<a href={resolve('/')} class="hover:text-slate-600 hover:underline">Privacy</a>
			<span>© 2026 Loop</span>
		</p>
	</footer>
</div>
