<script lang="ts">
	import BellIcon from '@lucide/svelte/icons/bell'
	import HeartIcon from '@lucide/svelte/icons/heart'
	import MessageCircleIcon from '@lucide/svelte/icons/message-circle'
	import Repeat2Icon from '@lucide/svelte/icons/repeat-2'
	import UserPlusIcon from '@lucide/svelte/icons/user'
	import { onMount } from 'svelte'
	import { resolve } from '$app/paths'
	import AppShell from '$lib/components/app/AppShell.svelte'
	import Avatar from '$lib/components/app/Avatar.svelte'
	import RelativeTime from '$lib/components/app/RelativeTime.svelte'
	import { api } from '$lib/api'
	import { t } from '$lib/i18n'
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
			error_message = e instanceof Error ? e.message : $t('notifications.error_load')
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
					// Fired from a link click, so it must survive the navigation that follows.
					keepalive: true,
				})
			).unread_count
			announce()
		} catch (e) {
			note.read = false
			unread += 1
			error_message = e instanceof Error ? e.message : $t('notifications.error_mark_one')
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
			error_message = e instanceof Error ? e.message : $t('notifications.error_mark_all')
		}
	}

	function message(note: NotificationView) {
		return note.type === 'like'
			? $t('notifications.msg_like')
			: note.type === 'repost'
				? $t('notifications.msg_repost')
				: note.type === 'comment'
					? $t('notifications.msg_comment')
					: $t('notifications.msg_follow')
	}
</script>

<AppShell user={data.user} title={$t('notifications.title')}>
	<div class="mx-auto w-full max-w-2xl">
		{#if unread > 0}
			<div class="mb-4 flex items-center justify-between px-1">
				<span class="text-xs font-bold tracking-wider text-slate-500 uppercase">
					{$t('notifications.unread', { values: { count: unread } })}
				</span>
				<button
					type="button"
					onclick={mark_all}
					class="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
				>
					{$t('notifications.mark_all')}
				</button>
			</div>
		{/if}

		{#if loading}
			<div
				class="divide-y divide-slate-100"
				aria-busy="true"
				aria-label={$t('notifications.loading')}
			>
				{#each [0, 1, 2] as n (n)}
					<div class="h-16 animate-pulse px-2 py-4">
						<div class="flex items-center gap-3.5">
							<div class="size-10 rounded-full bg-slate-200/80 dark:bg-slate-700/80"></div>
							<div class="flex-1 space-y-1.5 py-1">
								<div class="h-3.5 w-1/2 rounded bg-slate-200/80 dark:bg-slate-700/80"></div>
								<div class="h-3 w-1/4 rounded bg-slate-200/60 dark:bg-slate-700/60"></div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{:else if error_message && items.length === 0}
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
		{:else if items.length === 0}
			<div class="px-4 py-12 text-center">
				<BellIcon class="mx-auto mb-3 size-8 text-slate-300" />
				<p class="text-sm text-slate-500">
					{$t('notifications.empty')}
				</p>
			</div>
		{:else}
			{#if error_message}<p class="mb-3 text-sm text-rose-600" role="alert">{error_message}</p>{/if}
			<ul
				class="divide-y divide-slate-100 border-b border-slate-200/60 dark:divide-slate-800 dark:border-slate-800"
			>
				{#each items as note (note.id)}
					<li>
						<a
							href={note.type === 'follow'
								? resolve('/u/[handle]', { handle: note.actor.handle })
								: note.post_id
									? resolve('/posts/[id]', { id: note.post_id })
									: resolve('/')}
							onclick={() => mark_one(note)}
							class="flex items-center gap-3.5 p-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/60 {!note.read
								? 'bg-indigo-50/20'
								: ''}"
							data-unread={!note.read}
						>
							<span class="relative shrink-0">
								<Avatar user={note.actor} size={40} />
								<span
									class="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full ring-2 ring-white {note.type ===
									'like'
										? 'bg-rose-500 text-white'
										: note.type === 'repost'
											? 'bg-teal-500 text-white'
											: note.type === 'comment'
												? 'bg-emerald-500 text-white'
												: 'bg-indigo-600 text-white'}"
								>
									{#if note.type === 'like'}<HeartIcon
											class="size-3 fill-current"
										/>{:else if note.type === 'repost'}<Repeat2Icon
											class="size-3"
										/>{:else if note.type === 'comment'}<MessageCircleIcon
											class="size-3"
										/>{:else}<UserPlusIcon class="size-3" />{/if}
								</span>
							</span>
							<span class="min-w-0 flex-1">
								<span class="block text-sm text-slate-900 dark:text-slate-100"
									><strong>{note.actor.name}</strong> {message(note)}</span
								>
								{#if note.snippet}<span
										class="mt-1 block truncate border-l-2 border-slate-200 pl-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"
										>“{note.snippet}”</span
									>{/if}
								<span class="mt-1 block text-xs text-slate-400"
									><RelativeTime iso={note.created_at} /></span
								>
							</span>
							{#if !note.read}<span
									class="my-auto size-2 shrink-0 rounded-full bg-indigo-600"
									aria-label={$t('notifications.unread_badge')}
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
						class="rounded-full border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-60"
						>{loading_more ? $t('common.loading') : $t('common.load_more')}</button
					>
				</div>
			{/if}
		{/if}
	</div>
</AppShell>
