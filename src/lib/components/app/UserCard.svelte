<script lang="ts">
	import { resolve } from '$app/paths'
	import type { UserListItem } from '$lib/types'
	import Avatar from './Avatar.svelte'
	import FollowButton from './FollowButton.svelte'

	let { person }: { person: UserListItem } = $props()
	let override = $state<boolean | null>(null)
	let following = $derived(override ?? person.is_following)
</script>

<div
	class="group flex w-44 shrink-0 flex-col items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 text-center shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
>
	<a
		href={resolve('/u/[handle]', { handle: person.handle })}
		class="flex w-full flex-col items-center overflow-hidden"
	>
		<div class="relative transition-transform duration-200 group-hover:scale-105">
			<Avatar user={person} size={48} />
			{#if !person.is_self && person.is_followed_by}
				<span
					class="py-0.2 absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-white bg-slate-900 px-1.5 text-[9px] font-bold text-white shadow-2xs"
				>
					Follows you
				</span>
			{/if}
		</div>

		<div class="mt-2.5 w-full min-w-0">
			<span class="block truncate text-xs font-bold text-slate-900 group-hover:text-indigo-600">
				{person.name}
			</span>
			<span class="block truncate text-[11px] text-slate-400">
				{person.username ? `@${person.username}` : ''}
			</span>
			{#if person.bio}
				<p class="mt-1 line-clamp-2 text-[11px] leading-tight text-slate-500">
					{person.bio}
				</p>
			{/if}
		</div>
	</a>

	{#if !person.is_self}
		<div class="mt-3 w-full">
			<FollowButton
				handle={person.handle}
				{following}
				follows_you={Boolean(person.is_followed_by)}
				on_change={(s) => (override = s.following)}
			/>
		</div>
	{/if}
</div>
