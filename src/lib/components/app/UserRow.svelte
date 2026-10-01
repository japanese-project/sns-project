<script lang="ts">
	import { resolve } from '$app/paths'
	import type { UserListItem } from '$lib/types'
	import Avatar from './Avatar.svelte'
	import FollowButton from './FollowButton.svelte'

	let { person, signed_in }: { person: UserListItem; signed_in: boolean } = $props()
	let override = $state<boolean | null>(null)
	let following = $derived(override ?? person.is_following)
</script>

<li class="flex items-center gap-3 rounded-3xl bg-white/80 p-3 pr-4 ring-1 ring-slate-200/70">
	<a
		href={resolve('/u/[handle]', { handle: person.handle })}
		class="flex min-w-0 flex-1 items-center gap-3"
	>
		<Avatar user={person} size={44} />
		<span class="min-w-0">
			<span class="block truncate font-semibold text-slate-900">{person.name}</span>
			<span class="block truncate text-sm text-slate-500"
				>{person.username ? `@${person.username}` : ''}</span
			>
		</span>
	</a>
	{#if signed_in && !person.is_self}
		<FollowButton handle={person.handle} {following} on_change={(s) => (override = s.following)} />
	{/if}
</li>
