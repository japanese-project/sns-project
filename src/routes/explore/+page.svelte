<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search'
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import AppShell from '$lib/components/app/AppShell.svelte'
	import PostCard from '$lib/components/app/PostCard.svelte'
	import UserRow from '$lib/components/app/UserRow.svelte'
	import { api } from '$lib/api'
	import { MAX_SEARCH_LENGTH } from '$lib/limits'
	import type { Page, PostView } from '$lib/types'

	let { data } = $props()

	let input = $state('')
	// Reset local paging state whenever a new search result set arrives.
	let extra_posts = $state<PostView[]>([])
	let next_cursor = $state<string | null>(null)
	let loading_more = $state(false)
	let more_error = $state<string | null>(null)

	$effect(() => {
		input = data.query
		extra_posts = []
		next_cursor = data.results?.next_cursor ?? null
	})

	let posts = $derived([...(data.results?.posts ?? []), ...extra_posts])

	function submit(event: SubmitEvent) {
		event.preventDefault()
		const q = input.trim()
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto(q ? `${resolve('/explore')}?q=${encodeURIComponent(q)}` : resolve('/explore'))
	}

	async function load_more() {
		if (!next_cursor || loading_more) return
		loading_more = true
		more_error = null
		try {
			const page = await api<Page<PostView> & { posts?: PostView[] }>(
				`/api/search?q=${encodeURIComponent(data.query)}&cursor=${encodeURIComponent(next_cursor)}`,
			)
			const result = page as unknown as { posts: PostView[]; next_cursor: string | null }
			extra_posts = [...extra_posts, ...result.posts]
			next_cursor = result.next_cursor
		} catch (e) {
			more_error = e instanceof Error ? e.message : 'Could not load more results'
		} finally {
			loading_more = false
		}
	}
</script>

<AppShell user={data.user} title="Explore">
	<form onsubmit={submit} role="search" class="relative">
		<SearchIcon
			class="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-slate-400"
		/>
		<input
			type="search"
			bind:value={input}
			maxlength={MAX_SEARCH_LENGTH}
			placeholder="Search people or posts…"
			aria-label="Search"
			class="w-full rounded-full border-0 bg-white/80 py-4 pr-5 pl-13 text-slate-900 shadow-sm ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-slate-400"
		/>
	</form>

	<div class="mt-8 space-y-8">
		{#if data.error}
			<p class="rounded-3xl bg-rose-50 p-4 text-sm text-rose-700" role="alert">{data.error}</p>
		{:else if !data.results}
			<p class="py-12 text-center text-slate-500">
				Type a name, @username, or some words from a post.
			</p>
		{:else}
			<section aria-labelledby="people-heading">
				<h2
					id="people-heading"
					class="mb-3 px-2 text-xs font-semibold tracking-widest text-slate-400 uppercase"
				>
					People
				</h2>
				{#if data.results.users.length === 0}
					<p class="px-2 text-sm text-slate-500">No people match “{data.query}”.</p>
				{:else}
					<ul class="space-y-2">
						{#each data.results.users as person (person.id)}
							<UserRow {person} signed_in={data.user !== null} />
						{/each}
					</ul>
				{/if}
			</section>

			<section aria-labelledby="posts-heading">
				<h2
					id="posts-heading"
					class="mb-3 px-2 text-xs font-semibold tracking-widest text-slate-400 uppercase"
				>
					Posts
				</h2>
				{#if posts.length === 0}
					<p class="px-2 text-sm text-slate-500">No posts match “{data.query}”.</p>
				{:else}
					<div class="space-y-6">
						{#each posts as post (post.id)}
							<PostCard
								{post}
								signed_in={data.user !== null}
								on_deleted={(id) => (extra_posts = extra_posts.filter((p) => p.id !== id))}
							/>
						{/each}
					</div>
					{#if more_error}<p class="mt-3 text-center text-sm text-rose-600" role="alert">
							{more_error}
						</p>{/if}
					{#if next_cursor}
						<div class="mt-6 flex justify-center">
							<button
								type="button"
								onclick={load_more}
								disabled={loading_more}
								class="rounded-full bg-white px-5 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 disabled:opacity-60"
							>
								{loading_more ? 'Loading…' : 'Load more'}
							</button>
						</div>
					{/if}
				{/if}
			</section>
		{/if}
	</div>
</AppShell>
