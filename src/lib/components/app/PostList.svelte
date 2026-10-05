<script lang="ts">
	import { onMount } from 'svelte'
	import { api } from '$lib/api'
	import { composer } from '$lib/composer-state.svelte'
	import type { Page, PostView } from '$lib/types'
	import PostCard from './PostCard.svelte'

	let {
		endpoint,
		empty_message = 'Nothing here yet.',
		accepts_new_posts = false,
	}: {
		endpoint: string
		empty_message?: string
		accepts_new_posts?: boolean
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
			// De-duplicate in case a post created locally also arrives from the server.
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

	let last_endpoint = $state<string | null>(null)
	let sentinel = $state<HTMLElement | null>(null)

	// Infinite scroll: fetch the next page as the end of the list nears the viewport. A failed
	// page stops auto-loading (otherwise a persistent error would retry in a loop); the
	// "Try again" button below resumes it.
	$effect(() => {
		if (!sentinel || !next_cursor || typeof IntersectionObserver === 'undefined') return
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting) && !loading_more && !error_message) {
					void load(false)
				}
			},
			{ rootMargin: '600px 0px' },
		)
		observer.observe(sentinel)
		return () => observer.disconnect()
	})

	$effect(() => {
		const current = endpoint
		if (last_endpoint !== null && current !== last_endpoint) {
			next_cursor = null
			posts = []
			void load(true)
		}
		last_endpoint = current
	})

	onMount(() => {
		void load(true)
		const on_refresh = () => {
			next_cursor = null
			void load(true)
		}
		window.addEventListener('feed:refresh', on_refresh)

		const cleanup_composer = accepts_new_posts
			? composer.on_created((created) => {
					posts = [created, ...posts.filter((p) => p.id !== created.id)]
				})
			: undefined

		return () => {
			window.removeEventListener('feed:refresh', on_refresh)
			cleanup_composer?.()
		}
	})
</script>

<div class="space-y-10">
	{#if loading}
		<div class="space-y-10" aria-busy="true" aria-label="Loading posts">
			{#each [0, 1, 2] as n (n)}
				<div class="h-32 animate-pulse px-2 py-5">
					<div class="flex gap-3">
						<div class="size-11 rounded-full bg-slate-200/80"></div>
						<div class="flex-1 space-y-2 py-1">
							<div class="h-3.5 w-1/3 rounded bg-slate-200/80"></div>
							<div class="h-4 w-4/5 rounded bg-slate-200/60"></div>
							<div class="h-4 w-2/3 rounded bg-slate-200/60"></div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{:else if error_message && posts.length === 0}
		<div class="px-4 py-12 text-center" role="alert">
			<p class="text-sm font-medium text-rose-600">{error_message}</p>
			<button
				type="button"
				onclick={() => load(true)}
				class="mt-4 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
				>Try again</button
			>
		</div>
	{:else if posts.length === 0}
		<div class="px-4 py-12 text-center">
			<p class="text-sm text-slate-500">{empty_message}</p>
			{#if accepts_new_posts}
				<button
					type="button"
					onclick={() => composer.show()}
					class="mt-4 rounded-full bg-black px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800"
					>Write the first post</button
				>
			{/if}
		</div>
	{:else}
		{#each posts as post (post.id)}
			<PostCard
				{post}
				on_deleted={(id) => (posts = posts.filter((p) => p.id !== id))}
				on_updated={(updated) => (posts = posts.map((p) => (p.id === updated.id ? updated : p)))}
			/>
		{/each}

		{#if error_message}
			<p class="text-center text-sm text-rose-600" role="alert">{error_message}</p>
		{/if}
		{#if next_cursor}
			<div bind:this={sentinel} class="flex justify-center py-4" aria-live="polite">
				{#if error_message}
					<button
						type="button"
						onclick={() => load(false)}
						class="rounded-full bg-white px-5 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
						>Try again</button
					>
				{:else}
					<span class="text-xs text-slate-400">{loading_more ? 'Loading…' : ''}</span>
				{/if}
			</div>
		{:else}
			<p class="text-center text-xs text-slate-400">You're all caught up.</p>
		{/if}
	{/if}
</div>
