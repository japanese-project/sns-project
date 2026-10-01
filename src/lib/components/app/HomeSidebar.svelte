<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { resolve } from '$app/paths'
	import CompassIcon from '@lucide/svelte/icons/compass'
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

	const popular_topics = ['Technology', 'Design', 'WebDev', 'OpenSource', 'Photography', 'Science']
</script>

<div class="space-y-4">
	<!-- Trending / Popular Topics -->
	<section
		class="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-xs"
		aria-labelledby="trending-heading"
	>
		<div class="flex items-center gap-2 text-slate-800">
			<TrendingUpIcon class="size-4 text-indigo-600" />
			<h2 id="trending-heading" class="text-xs font-bold tracking-wider text-slate-700 uppercase">
				Discover Topics
			</h2>
		</div>

		<div class="mt-3 flex flex-wrap gap-1.5">
			{#each popular_topics as topic (topic)}
				<a
					href={`${resolve('/explore')}?q=${encodeURIComponent(topic)}`}
					class="rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
				>
					#{topic}
				</a>
			{/each}
		</div>

		<div class="mt-3 border-t border-slate-100 pt-2.5">
			<a
				href={resolve('/explore')}
				class="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
			>
				<CompassIcon class="size-3.5" />
				Explore all topics
			</a>
		</div>
	</section>

	<!-- Who to follow -->
	{#if suggested_users.length > 0}
		<section
			class="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-xs"
			aria-labelledby="who-to-follow-heading"
		>
			<div class="flex items-center gap-2 text-slate-800">
				<SparklesIcon class="size-4 text-amber-500" />
				<h2
					id="who-to-follow-heading"
					class="text-xs font-bold tracking-wider text-slate-700 uppercase"
				>
					Who to Follow
				</h2>
			</div>

			<ul class="mt-3 space-y-3">
				{#each suggested_users as person (person.id)}
					<li class="flex items-center justify-between gap-2.5">
						<a
							href={resolve('/u/[handle]', { handle: person.handle })}
							class="group flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden"
						>
							<div class="shrink-0"><Avatar user={person} size={32} /></div>
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
		</section>
	{/if}

	<!-- Community info -->
	<footer class="px-2 text-[11px] leading-relaxed text-slate-400">
		<p class="flex flex-wrap gap-x-3 gap-y-1">
			<a href={resolve('/explore')} class="hover:text-slate-600 hover:underline">Explore</a>
			<a href={resolve('/login')} class="hover:text-slate-600 hover:underline">About</a>
			<span>© 2026 Loop</span>
		</p>
	</footer>
</div>
