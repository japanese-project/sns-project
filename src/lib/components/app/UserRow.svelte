<script lang="ts">
	import { resolve } from '$app/paths'
	import type { UserListItem } from '$lib/types'
	import Avatar from './Avatar.svelte'
	import FollowButton from './FollowButton.svelte'

	let { person, signed_in }: { person: UserListItem; signed_in: boolean } = $props()
	let override = $state<boolean | null>(null)
	let following = $derived(override ?? person.is_following)
</script>

<li
	class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs transition hover:border-slate-300"
>
	<a
		href={resolve('/u/[handle]', { handle: person.handle })}
		class="flex min-w-0 flex-1 items-center gap-3 overflow-hidden"
	>
		<div class="shrink-0"><Avatar user={person} size={40} /></div>
		<div class="min-w-0 flex-1">
			<div class="flex items-center gap-1.5 overflow-hidden">
				<span class="truncate text-sm font-semibold text-slate-900">{person.name}</span>
				{#if signed_in && !person.is_self && person.is_followed_by}
					<span
						class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[0.65rem] font-semibold text-slate-600"
					>
						Follows you
					</span>
				{/if}
			</div>
			<span class="block truncate text-xs text-slate-400">
				{person.username ? `@${person.username}` : ''}
			</span>
			{#if person.bio}
				<p class="mt-0.5 line-clamp-1 text-xs text-slate-600">{person.bio}</p>
			{/if}
		</div>
	</a>

	{#if !person.is_self}
		<div class="shrink-0">
			<FollowButton
				handle={person.handle}
				{following}
				follows_you={Boolean(person.is_followed_by)}
				{signed_in}
				on_change={(s) => (override = s.following)}
			/>
		</div>
	{/if}
</li>
