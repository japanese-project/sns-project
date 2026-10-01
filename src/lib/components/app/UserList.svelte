<script lang="ts">
	import { onMount } from 'svelte'
	import { resolve } from '$app/paths'
	import { api } from '$lib/api'
	import type { Page, UserListItem, UserSummary } from '$lib/types'
	import UserRow from './UserRow.svelte'

	let { owner, kind }: { owner: UserSummary; kind: 'followers' | 'following' } = $props()

	let people = $state<UserListItem[]>([])
	let next_cursor = $state<string | null>(null)
	let loading = $state(true)
	let loading_more = $state(false)
	let error_message = $state<string | null>(null)

	async function load(initial: boolean) {
		if (initial) loading = true
		else loading_more = true
		error_message = null
		try {
			const base = `/api/users/${encodeURIComponent(owner.handle)}/${kind}`
			const page = await api<Page<UserListItem>>(
				initial ? base : `${base}?cursor=${encodeURIComponent(next_cursor ?? '')}`,
			)
			people = initial ? page.items : [...people, ...page.items]
			next_cursor = page.next_cursor
		} catch (e) {
			error_message = e instanceof Error ? e.message : 'Could not load list'
		} finally {
			loading = false
			loading_more = false
		}
	}

	onMount(() => void load(true))
</script>

<a
	href={resolve('/u/[handle]', { handle: owner.handle })}
	class="mb-4 inline-block px-2 text-sm text-slate-500 hover:text-slate-900">← {owner.name}</a
>
<h2 class="mb-4 px-2 text-2xl font-semibold text-slate-900 capitalize">{kind}</h2>

{#if loading}
	<div class="space-y-2" aria-busy="true">
		{#each [0, 1, 2] as n (n)}<div class="h-16 animate-pulse rounded-3xl bg-white/60"></div>{/each}
	</div>
{:else if error_message && people.length === 0}
	<div class="rounded-3xl bg-white/80 p-8 text-center" role="alert">
		<p class="text-rose-600">{error_message}</p>
		<button
			type="button"
			onclick={() => load(true)}
			class="mt-3 rounded-full bg-black px-4 py-2 text-sm text-white">Try again</button
		>
	</div>
{:else if people.length === 0}
	<p class="rounded-3xl bg-white/80 p-10 text-center text-slate-500 ring-1 ring-slate-200">
		{kind === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
	</p>
{:else}
	<ul class="space-y-2">
		{#each people as person (person.id)}<UserRow {person} signed_in={true} />{/each}
	</ul>
	{#if error_message}<p class="mt-3 text-center text-sm text-rose-600" role="alert">
			{error_message}
		</p>{/if}
	{#if next_cursor}
		<div class="mt-6 flex justify-center">
			<button
				type="button"
				onclick={() => load(false)}
				disabled={loading_more}
				class="rounded-full bg-white px-5 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 disabled:opacity-60"
				>{loading_more ? 'Loading…' : 'Load more'}</button
			>
		</div>
	{/if}
{/if}
