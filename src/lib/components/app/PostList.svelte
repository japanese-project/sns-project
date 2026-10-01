<script lang="ts">
	import { onMount } from 'svelte'
	import { api } from '$lib/api'
	import type { Page, PostView } from '$lib/types'
	import PostCard from './PostCard.svelte'

	let {
		endpoint,
		signed_in,
		empty_message = 'Nothing here yet.',
	}: {
		endpoint: string
		signed_in: boolean
		empty_message?: string
	} = $props()

	let posts = $state<PostView[]>([])
	let next_cursor = $state<string | null>(null)
	let loading = $state(true)
	let loading_more = $state(false)
	let error_message = $state<string | null>(null)

	function url(cursor: string | null) {
		const joiner = endpoint.includes('?') ? '&' : '?'
		return cursor ? `${endpoint}${joiner}cursor=${encodeURIComponent(cursor)}` : endpoint
	}

	async function load(initial: boolean) {
		if (initial) loading = true
		else loading_more = true
		error_message = null
		try {
			const page = await api<Page<PostView>>(url(initial ? null : next_cursor))
			const known = new Set(initial ? [] : posts.map((p) => p.id))
			const fresh = page.items.filter((p) => !known.has(p.id))
			posts = initial ? fresh : [...posts, ...fresh]
			next_cursor = page.next_cursor
		} catch (e) {
			error_message = e instanceof Error ? e.message : 'Could not load posts'
		} finally {
			loading = false
			loading_more = false
		}
	}

	onMount(() => {
		void load(true)
	})
</script>

<div class="space-y-6">
	{#if loading}
		<div class="space-y-6" aria-busy="true" aria-label="Loading posts">
			{#each [0, 1, 2] as n (n)}
				<div class="h-40 animate-pulse rounded-[2rem] bg-white/60"></div>
			{/each}
		</div>
	{:else if error_message && posts.length === 0}
		<div class="rounded-[2rem] bg-white/80 p-8 text-center ring-1 ring-slate-200" role="alert">
			<p class="text-rose-600">{error_message}</p>
			<button
				type="button"
				onclick={() => load(true)}
				class="mt-3 rounded-full bg-black px-4 py-2 text-sm text-white">Try again</button
			>
		</div>
	{:else if posts.length === 0}
		<div class="rounded-[2rem] bg-white/80 p-10 text-center ring-1 ring-slate-200">
			<p class="text-slate-500">{empty_message}</p>
		</div>
	{:else}
		{#each posts as post (post.id)}
			<PostCard
				{post}
				{signed_in}
				on_deleted={(id) => (posts = posts.filter((p) => p.id !== id))}
			/>
		{/each}

		{#if error_message}
			<p class="text-center text-sm text-rose-600" role="alert">{error_message}</p>
		{/if}
		{#if next_cursor}
			<div class="flex justify-center">
				<button
					type="button"
					disabled={loading_more}
					onclick={() => load(false)}
					class="rounded-full bg-white px-5 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
				>
					{loading_more ? 'Loading…' : 'Load more'}
				</button>
			</div>
		{:else}
			<p class="text-center text-xs text-slate-400">You're all caught up.</p>
		{/if}
	{/if}
</div>
