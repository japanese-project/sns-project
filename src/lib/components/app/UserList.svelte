<script lang="ts">
	import { onMount } from 'svelte'
	import { resolve } from '$app/paths'
	import { api } from '$lib/api'
	import type { Page, UserListItem, UserSummary } from '$lib/types'
	import UserRow from './UserRow.svelte'

	let {
		owner,
		kind,
		signed_in = true,
	}: { owner: UserSummary; kind: 'followers' | 'following'; signed_in?: boolean } = $props()

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

<div class="mx-auto w-full max-w-2xl">
	<div class="mb-4 flex items-center justify-between">
		<a
			href={resolve('/u/[handle]', { handle: owner.handle })}
			class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900"
		>
			← {owner.name}
		</a>
		<span class="text-xs font-bold tracking-wider text-slate-400 uppercase">
			{kind}
		</span>
	</div>

	{#if loading}
		<div class="space-y-2.5" aria-busy="true">
			{#each [0, 1, 2] as n (n)}
				<div class="h-16 animate-pulse rounded-2xl border border-slate-200/60 bg-white/60"></div>
			{/each}
		</div>
	{:else if error_message && people.length === 0}
		<div
			class="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-xs"
			role="alert"
		>
			<p class="text-sm font-medium text-rose-600">{error_message}</p>
			<button
				type="button"
				onclick={() => load(true)}
				class="mt-4 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
			>
				Try again
			</button>
		</div>
	{:else if people.length === 0}
		<div class="rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-xs">
			<p class="text-sm text-slate-500">
				{kind === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
			</p>
		</div>
	{:else}
		<ul class="space-y-2.5">
			{#each people as person (person.id)}
				<UserRow {person} {signed_in} />
			{/each}
		</ul>
		{#if error_message}
			<p class="mt-3 text-center text-sm text-rose-600" role="alert">
				{error_message}
			</p>
		{/if}
		{#if next_cursor}
			<div class="mt-6 flex justify-center">
				<button
					type="button"
					onclick={() => load(false)}
					disabled={loading_more}
					class="rounded-full border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-60"
				>
					{loading_more ? 'Loading…' : 'Load more'}
				</button>
			</div>
		{/if}
	{/if}
</div>
