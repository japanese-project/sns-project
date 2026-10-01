<script lang="ts">
	import { resolve } from '$app/paths'
	import type { UserListItem } from '$lib/types'
	import Avatar from './Avatar.svelte'
	import FollowButton from './FollowButton.svelte'

	let { person, signed_in }: { person: UserListItem; signed_in: boolean } = $props()
	let override = $state<boolean | null>(null)
	let following = $derived(override ?? person.is_following)
</script>

<li class="flex items-center gap-3 rounded-3xl bg-white/80 p-3.5 pr-4 ring-1 ring-slate-200/70">
	<a
		href={resolve('/u/[handle]', { handle: person.handle })}
		class="flex min-w-0 flex-1 items-center gap-3"
	>
		<Avatar user={person} size={44} />
		<span class="min-w-0 flex-1">
			<span class="flex items-center gap-1.5 truncate">
				<span class="truncate font-semibold text-slate-900">{person.name}</span>
				{#if signed_in && !person.is_self && person.is_followed_by}
					<span
						class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[0.65rem] font-medium text-slate-600"
						>Follows you</span
					>
				{/if}
			</span>
			<span class="block truncate text-xs text-slate-500"
				>{person.username ? `@${person.username}` : ''}</span
			>
			{#if person.bio}
				<p class="mt-0.5 line-clamp-1 text-xs text-slate-600">{person.bio}</p>
			{/if}
		</span>
	</a>
	{#if signed_in && !person.is_self}
		<FollowButton
			handle={person.handle}
			{following}
			follows_you={Boolean(person.is_followed_by)}
			on_change={(s) => (override = s.following)}
		/>
	{/if}
</li>
