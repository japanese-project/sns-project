<script lang="ts">
	import BellIcon from '@lucide/svelte/icons/bell'
	import HeartIcon from '@lucide/svelte/icons/heart'
	import MessageCircleIcon from '@lucide/svelte/icons/message-circle'
	import UserPlusIcon from '@lucide/svelte/icons/user'
	import { onMount } from 'svelte'
	import { resolve } from '$app/paths'
	import AppShell from '$lib/components/app/AppShell.svelte'
	import Avatar from '$lib/components/app/Avatar.svelte'
	import { api } from '$lib/api'
	import { relative_time } from '$lib/time'
	import type { NotificationView, Page } from '$lib/types'

	let { data } = $props()

	let items = $state<NotificationView[]>([])
	let next_cursor = $state<string | null>(null)
	let unread = $state(0)
	let loading = $state(true)
	let loading_more = $state(false)
	let error_message = $state<string | null>(null)

	async function load(initial: boolean) {
		if (initial) loading = true
		else loading_more = true
		error_message = null
		try {
			const cursor = initial ? '' : `?cursor=${encodeURIComponent(next_cursor ?? '')}`
			const page = await api<Page<NotificationView> & { unread_count: number }>(
				`/api/notifications${cursor}`,
			)
			items = initial ? page.items : [...items, ...page.items]
			next_cursor = page.next_cursor
			unread = page.unread_count
		} catch (e) {
			error_message = e instanceof Error ? e.message : 'Could not load notifications'
		} finally {
			loading = false
			loading_more = false
		}
	}

	onMount(() => void load(true))

	function announce() {
		window.dispatchEvent(new Event('notifications:changed'))
	}

	async function mark_one(note: NotificationView) {
		if (note.read) return
		note.read = true // optimistic
		unread = Math.max(0, unread - 1)
		try {
			unread = (
				await api<{ unread_count: number }>('/api/notifications/read', {
					method: 'POST',
					body: { id: note.id },
				})
			).unread_count
			announce()
		} catch (e) {
			note.read = false
			unread += 1
			error_message = e instanceof Error ? e.message : 'Could not mark as read'
		}
	}

	async function mark_all() {
		const snapshot = items.map((n) => n.read)
		const previous_unread = unread
		items.forEach((n) => (n.read = true))
		unread = 0
		try {
			await api('/api/notifications/read', { method: 'POST', body: {} })
			announce()
		} catch (e) {
			items.forEach((n, i) => (n.read = snapshot[i]))
			unread = previous_unread
			error_message = e instanceof Error ? e.message : 'Could not mark all as read'
		}
	}

	function message(note: NotificationView) {
		return note.type === 'like'
			? 'liked your post.'
			: note.type === 'comment'
				? 'commented on your post.'
				: 'started following you.'
	}
</script>

<AppShell user={data.user} title="Activity">
	<div class="mb-4 flex items-center justify-between px-2">
		<h2 class="text-2xl font-semibold text-slate-900">Activity</h2>
		{#if unread > 0}
			<button
				type="button"
				onclick={mark_all}
				class="rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white"
				>Mark all as read ({unread})</button
			>
		{/if}
	</div>

	{#if loading}
		<div class="space-y-3" aria-busy="true" aria-label="Loading notifications">
			{#each [0, 1, 2] as n (n)}<div
					class="h-20 animate-pulse rounded-3xl bg-white/60"
				></div>{/each}
		</div>
	{:else if error_message && items.length === 0}
		<div class="rounded-3xl bg-white/80 p-8 text-center ring-1 ring-slate-200" role="alert">
			<p class="text-rose-600">{error_message}</p>
			<button
				type="button"
				onclick={() => load(true)}
				class="mt-3 rounded-full bg-black px-4 py-2 text-sm text-white">Try again</button
			>
		</div>
	{:else if items.length === 0}
		<div class="rounded-3xl bg-white/80 p-10 text-center text-slate-500 ring-1 ring-slate-200">
			<BellIcon class="mx-auto mb-3 size-8 text-slate-300" />
			You're all caught up. Likes, comments and new followers will show up here.
		</div>
	{:else}
		{#if error_message}<p class="mb-3 text-sm text-rose-600" role="alert">{error_message}</p>{/if}
		<ul class="divide-y divide-slate-100 rounded-[2rem] bg-white/80 p-2 ring-1 ring-slate-200/70">
			{#each items as note (note.id)}
				<li>
					<a
						href={note.type === 'follow'
							? resolve('/u/[handle]', { handle: note.actor.handle })
							: note.post_id
								? resolve('/posts/[id]', { id: note.post_id })
								: resolve('/')}
						onclick={() => mark_one(note)}
						class="flex gap-4 rounded-3xl p-4 hover:bg-slate-50"
						data-unread={!note.read}
					>
						<span class="relative">
							<Avatar user={note.actor} size={44} />
							<span
								class="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full ring-2 ring-white {note.type ===
								'like'
									? 'bg-rose-500 text-white'
									: note.type === 'comment'
										? 'bg-emerald-500 text-white'
										: 'bg-blue-500 text-white'}"
							>
								{#if note.type === 'like'}<HeartIcon
										class="size-3 fill-current"
									/>{:else if note.type === 'comment'}<MessageCircleIcon
										class="size-3"
									/>{:else}<UserPlusIcon class="size-3" />{/if}
							</span>
						</span>
						<span class="min-w-0 flex-1">
							<span class="block text-sm text-slate-800"
								><strong>{note.actor.name}</strong> {message(note)}</span
							>
							{#if note.snippet}<span
									class="mt-1 block truncate border-l-2 border-slate-200 pl-2 text-sm text-slate-500"
									>“{note.snippet}”</span
								>{/if}
							<span class="mt-1 block text-xs text-slate-400">{relative_time(note.created_at)}</span
							>
						</span>
						{#if !note.read}<span
								class="mt-2 size-2.5 shrink-0 rounded-full bg-blue-500"
								aria-label="Unread"
							></span>{/if}
					</a>
				</li>
			{/each}
		</ul>
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
</AppShell>
