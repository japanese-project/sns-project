<script lang="ts">
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

	const popular_topics = [
		{ tag: 'Technology', count: '1.2k posts' },
		{ tag: 'Design', count: '850 posts' },
		{ tag: 'WebDev', count: '640 posts' },
		{ tag: 'Photography', count: '490 posts' },
		{ tag: 'OpenSource', count: '410 posts' },
	]
</script>

<div class="space-y-6">
	<!-- Trending Topics -->
	<section
		class="rounded-[2.5rem] bg-white/80 p-6 shadow-sm ring-1 ring-slate-200/70 backdrop-blur"
		aria-labelledby="trending-heading"
	>
		<div class="flex items-center gap-2 text-slate-800">
			<TrendingUpIcon class="size-4 text-indigo-600" />
			<h2 id="trending-heading" class="text-sm font-bold tracking-tight">Trending Topics</h2>
		</div>

		<div class="mt-4 space-y-3">
			{#each popular_topics as topic (topic.tag)}
				<a
					href={resolve('/explore')}
					class="group flex items-center justify-between rounded-2xl p-2 transition hover:bg-slate-50"
				>
					<span class="text-sm font-medium text-slate-700 group-hover:text-indigo-600">
						#{topic.tag}
					</span>
					<span class="text-xs text-slate-400 tabular-nums">
						{topic.count}
					</span>
				</a>
			{/each}
		</div>

		<div class="mt-4 border-t border-slate-100 pt-3">
			<a
				href={resolve('/explore')}
				class="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
			>
				<CompassIcon class="size-3.5" />
				Explore all topics & people
			</a>
		</div>
	</section>

	<!-- Who to follow -->
	{#if suggested_users.length > 0}
		<section
			class="rounded-[2.5rem] bg-white/80 p-6 shadow-sm ring-1 ring-slate-200/70 backdrop-blur"
			aria-labelledby="who-to-follow-heading"
		>
			<div class="flex items-center gap-2 text-slate-800">
				<SparklesIcon class="size-4 text-amber-500" />
				<h2 id="who-to-follow-heading" class="text-sm font-bold tracking-tight">Who to Follow</h2>
			</div>

			<ul class="mt-4 space-y-4">
				{#each suggested_users as person (person.id)}
					<li class="flex items-center justify-between gap-3">
						<a
							href={resolve('/u/[handle]', { handle: person.handle })}
							class="group flex min-w-0 items-center gap-2.5"
						>
							<Avatar user={person} size={36} />
							<div class="min-w-0">
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
	<footer class="px-3 text-xs leading-relaxed text-slate-400">
		<p class="flex flex-wrap gap-x-3 gap-y-1">
			<a href={resolve('/explore')} class="hover:text-slate-600 hover:underline">Explore</a>
			<a href={resolve('/login#terms')} class="hover:text-slate-600 hover:underline">Terms</a>
			<a href={resolve('/login#privacy')} class="hover:text-slate-600 hover:underline">Privacy</a>
			<span>© 2026 Loop</span>
		</p>
	</footer>
</div>
