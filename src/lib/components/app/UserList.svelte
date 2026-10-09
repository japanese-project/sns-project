<script lang="ts">
	import { onMount } from 'svelte'
	import { resolve } from '$app/paths'
	import { api } from '$lib/api'
	import { t } from '$lib/i18n'
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
			error_message = e instanceof Error ? e.message : $t('user_list.error')
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
			{kind === 'followers' ? $t('user_list.followers') : $t('user_list.following')}
		</span>
	</div>

	{#if loading}
		<div class="divide-y divide-slate-100" aria-busy="true">
			{#each [0, 1, 2] as n (n)}
				<div class="h-16 animate-pulse px-2 py-3.5">
					<div class="flex items-center gap-3">
						<div class="size-10 rounded-full bg-slate-200/80"></div>
						<div class="flex-1 space-y-1.5 py-1">
							<div class="h-3.5 w-1/3 rounded bg-slate-200/80"></div>
							<div class="h-3 w-1/4 rounded bg-slate-200/60"></div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else if error_message && people.length === 0}
		<div class="px-4 py-12 text-center" role="alert">
			<p class="text-sm font-medium text-rose-600">{error_message}</p>
			<button
				type="button"
				onclick={() => load(true)}
				class="mt-4 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
			>
				{$t('common.try_again')}
			</button>
		</div>
	{:else if people.length === 0}
		<div class="px-4 py-12 text-center">
			<p class="text-sm text-slate-500">
				{kind === 'followers' ? $t('user_list.no_followers') : $t('user_list.no_following')}
			</p>
		</div>
	{:else}
		<ul class="divide-y divide-slate-100">
			{#each people as person (person.id)}
				<UserRow {person} />
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
					{loading_more ? $t('common.loading') : $t('common.load_more')}
				</button>
			</div>
		{/if}
	{/if}
</div>
