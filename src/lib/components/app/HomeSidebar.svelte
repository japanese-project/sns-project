<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { resolve } from '$app/paths'
	import CompassIcon from '@lucide/svelte/icons/compass'
	import SparklesIcon from '@lucide/svelte/icons/sparkles'
	import TagIcon from '@lucide/svelte/icons/tag'
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

	const curated_topics = ['Technology', 'Design', 'WebDev', 'OpenSource', 'Photography', 'Science']
</script>

<div class="space-y-6 px-1">
	<!-- Curated Discovery Topics -->
	<section aria-labelledby="topics-heading">
		<div class="flex items-center gap-1.5 text-slate-500">
			<TagIcon class="size-3.5" />
			<h2 id="topics-heading" class="text-[11px] font-bold tracking-wider uppercase">
				Curated Topics
			</h2>
		</div>

		<div class="mt-3 flex flex-wrap gap-1.5">
			{#each curated_topics as topic (topic)}
				<a
					href={`${resolve('/explore')}?q=${encodeURIComponent(topic)}`}
					class="rounded-full border border-slate-200/80 bg-white/70 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
				>
					#{topic}
				</a>
			{/each}
		</div>

		<div class="mt-2.5">
			<a
				href={resolve('/explore')}
				class="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
			>
				<CompassIcon class="size-3" />
				<span>Explore all topics</span>
			</a>
		</div>
	</section>

	<!-- Suggested People to Follow -->
	{#if suggested_users.length > 0}
		<div class="border-t border-slate-200/60 pt-5">
			<section aria-labelledby="suggested-heading">
				<div class="flex items-center gap-1.5 text-slate-500">
					<SparklesIcon class="size-3.5" />
					<h2 id="suggested-heading" class="text-[11px] font-bold tracking-wider uppercase">
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
								<div class="shrink-0"><Avatar user={person} size={30} /></div>
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
		</div>
	{/if}

	<!-- Quiet footer info -->
	<footer class="border-t border-slate-200/60 pt-4 text-[11px] text-slate-400">
		<p class="flex flex-wrap gap-x-3 gap-y-1">
			<a href={resolve('/explore')} class="hover:text-slate-600 hover:underline">Explore</a>
			<a href={resolve('/login')} class="hover:text-slate-600 hover:underline">About</a>
			<span>© 2026 Loop</span>
		</p>
	</footer>
</div>
