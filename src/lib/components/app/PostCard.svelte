<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check'
	import CopyIcon from '@lucide/svelte/icons/copy'
	import HeartIcon from '@lucide/svelte/icons/heart'
	import GlobeIcon from '@lucide/svelte/icons/globe'
	import LockIcon from '@lucide/svelte/icons/lock'
	import MessageCircleIcon from '@lucide/svelte/icons/message-circle'
	import MoreHorizontalIcon from '@lucide/svelte/icons/more-horizontal'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import TrashIcon from '@lucide/svelte/icons/trash'
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import { api } from '$lib/api'
	import { MAX_POST_LENGTH } from '$lib/limits'
	import { relative_time } from '$lib/time'
	import type { PostView } from '$lib/types'
	import Avatar from './Avatar.svelte'
	import Comments from './Comments.svelte'

	let {
		post,
		initial_open_comments = false,
		on_deleted,
		on_updated,
	}: {
		initial_open_comments?: boolean
		post: PostView
		on_deleted?: (id: string) => void
		on_updated?: (post: PostView) => void
	} = $props()

	// Optimistic like state: an override applied immediately and cleared (rolled back) if the
	// request fails. Without an override the values come straight from the post prop.
	let post_override = $state<PostView | null>(null)
	let active_post = $derived(post_override ?? post)
	let like_override = $state<{ liked: boolean; like_count: number } | null>(null)
	let comment_override = $state<number | null>(null)
	let liked = $derived(like_override?.liked ?? active_post.liked_by_me)
	let like_count = $derived(like_override?.like_count ?? active_post.like_count)
	let comment_count = $derived(comment_override ?? active_post.comment_count)
	let like_pending = $state(false)
	let comments_override = $state<boolean | null>(null)
	let show_comments = $derived(comments_override ?? initial_open_comments)
	let error_message = $state<string | null>(null)

	let editing = $state(false)
	let draft = $state('')
	let draft_visibility = $state<PostView['visibility']>('public')
	let saving = $state(false)
	let confirming_delete = $state(false)
	let deleting = $state(false)

	let menu_open = $state(false)
	let copied_link = $state(false)
	let menu_container_el = $state<HTMLElement | null>(null)

	$effect(() => {
		if (!menu_open) return
		function handle_doc_click(e: MouseEvent) {
			if (menu_container_el && !menu_container_el.contains(e.target as Node)) {
				menu_open = false
			}
		}
		function handle_doc_keydown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				menu_open = false
			}
		}
		window.addEventListener('click', handle_doc_click)
		window.addEventListener('keydown', handle_doc_keydown)
		return () => {
			window.removeEventListener('click', handle_doc_click)
			window.removeEventListener('keydown', handle_doc_keydown)
		}
	})

	async function handle_copy_link(event: MouseEvent) {
		event.stopPropagation()
		const post_url = `${window.location.origin}${resolve('/posts/[id]', { id: post.id })}`
		try {
			if (navigator?.clipboard?.writeText) {
				await navigator.clipboard.writeText(post_url)
			}
			copied_link = true
			setTimeout(() => {
				copied_link = false
				menu_open = false
			}, 1000)
		} catch {
			menu_open = false
		}
	}

	async function toggle_like() {
		if (like_pending) return
		const previous = { liked, like_count }
		like_pending = true
		error_message = null
		liked = !liked
		like_count += liked ? 1 : -1
		try {
			const result = await api<{ liked: boolean; like_count: number }>(
				`/api/posts/${post.id}/like`,
				{
					method: liked ? 'PUT' : 'DELETE',
				},
			)
			liked = result.liked
			like_count = result.like_count
		} catch (e) {
			liked = previous.liked
			like_count = previous.like_count
			error_message = e instanceof Error ? e.message : 'Could not update like'
		} finally {
			like_pending = false
		}
	}

	async function save_edit(event: SubmitEvent) {
		event.preventDefault()
		const is_empty = draft.trim().length === 0 && !active_post.image_url
		if (saving || is_empty || draft.length > MAX_POST_LENGTH) return
		saving = true
		error_message = null
		try {
			const updated = await api<PostView>(`/api/posts/${post.id}`, {
				method: 'PATCH',
				body: { content: draft, visibility: draft_visibility },
			})
			post_override = updated
			editing = false
			on_updated?.(updated)
		} catch (e) {
			error_message = e instanceof Error ? e.message : 'Could not save changes'
		} finally {
			saving = false
		}
	}

	async function confirm_delete() {
		deleting = true
		error_message = null
		try {
			await api(`/api/posts/${post.id}`, { method: 'DELETE' })
			on_deleted?.(post.id)
		} catch (e) {
			error_message = e instanceof Error ? e.message : 'Could not delete post'
			deleting = false
			confirming_delete = false
		}
	}

	function handle_card_click(event: MouseEvent) {
		if (editing) return
		if (window.getSelection()?.toString()) return
		const target = event.target as HTMLElement | null
		if (target?.closest('a, button, input, textarea, form, [role="button"]')) {
			return
		}
		void goto(resolve('/posts/[id]', { id: post.id }))
	}

	function handle_card_keydown(event: KeyboardEvent) {
		if (editing) return
		if (event.key === 'Enter' || event.key === ' ') {
			const target = event.target as HTMLElement | null
			if (target?.closest('a, button, input, textarea, form, [role="button"]')) {
				return
			}
			event.preventDefault()
			void goto(resolve('/posts/[id]', { id: post.id }))
		}
	}

	function parse_hashtags(text: string) {
		const regex = /(#[a-zA-Z0-9_\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+)/g
		const parts = text.split(regex)
		return parts.map((part) => {
			if (part.startsWith('#') && part.length > 1) {
				return { type: 'tag' as const, text: part }
			}
			return { type: 'text' as const, text: part }
		})
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<article
	class="min-w-0 overflow-hidden border-b border-slate-200/60 px-2 py-5 [overflow-wrap:anywhere] break-words transition-colors hover:bg-slate-50/50 {!editing
		? 'cursor-pointer'
		: ''}"
	data-testid="post-card"
	onclick={handle_card_click}
	onkeydown={handle_card_keydown}
>
	<header class="flex items-center gap-3">
		<a
			href={resolve('/u/[handle]', {
				handle: post.author.handle || post.author.username || post.author.id || 'user',
			})}
			aria-label="{post.author.name}'s profile"
		>
			<Avatar user={post.author} size={44} />
		</a>
		<div class="min-w-0 flex-1">
			<a
				href={resolve('/u/[handle]', {
					handle: post.author.handle || post.author.username || post.author.id || 'user',
				})}
				class="block truncate font-semibold text-slate-900 hover:underline">{post.author.name}</a
			>
			<p class="flex items-center gap-1.5 text-xs text-slate-500">
				{#if post.author.username}<span>@{post.author.username}</span><span aria-hidden="true"
						>•</span
					>{/if}
				<time
					datetime={active_post.created_at}
					title={new Date(active_post.created_at).toLocaleString()}
					>{relative_time(active_post.created_at)}</time
				>
				{#if active_post.updated_at !== active_post.created_at}<span>(edited)</span>{/if}
				{#if active_post.visibility === 'followers-only'}
					<span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5"
						><LockIcon class="size-3" /> Followers</span
					>
				{/if}
			</p>
		</div>
		{#if !editing}
			<div class="relative" bind:this={menu_container_el}>
				<button
					type="button"
					aria-label="More options"
					aria-haspopup="menu"
					aria-expanded={menu_open}
					onclick={(e) => {
						e.stopPropagation()
						menu_open = !menu_open
					}}
					class="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
				>
					<MoreHorizontalIcon class="size-4" />
				</button>
				{#if menu_open}
					<div
						role="menu"
						tabindex="-1"
						aria-label="Post actions"
						class="absolute top-full right-0 z-20 mt-1 min-w-[150px] overflow-hidden rounded-xl border border-slate-200/80 bg-white py-1 shadow-lg shadow-slate-900/10 focus:outline-none"
					>
						<button
							type="button"
							role="menuitem"
							onclick={handle_copy_link}
							class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
						>
							{#if copied_link}
								<CheckIcon class="size-4 text-emerald-600" />
								<span class="text-emerald-600">Copied!</span>
							{:else}
								<CopyIcon class="size-4 text-slate-400" />
								<span>Copy link</span>
							{/if}
						</button>

						{#if post.is_owner}
							<button
								type="button"
								role="menuitem"
								onclick={() => {
									menu_open = false
									draft = active_post.content
									draft_visibility = active_post.visibility
									editing = true
								}}
								class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
							>
								<PencilIcon class="size-4 text-slate-400" />
								<span>Edit post</span>
							</button>

							<button
								type="button"
								role="menuitem"
								onclick={() => {
									menu_open = false
									confirming_delete = true
								}}
								class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-rose-600 transition hover:bg-rose-50"
							>
								<TrashIcon class="size-4 text-rose-500" />
								<span>Delete post</span>
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</header>

	{#if editing}
		<form onsubmit={save_edit} class="mt-3 space-y-3">
			<div class="flex items-center justify-between text-xs">
				<span class="flex items-center gap-1.5 font-semibold text-slate-400">
					<PencilIcon class="size-3.5 text-indigo-500" />
					Editing
				</span>
				<div class="flex items-center gap-1">
					<button
						type="button"
						onclick={() => (draft_visibility = 'public')}
						class="flex items-center gap-1 rounded-full px-2.5 py-1 transition {draft_visibility ===
						'public'
							? 'bg-slate-100 font-semibold text-slate-900'
							: 'text-slate-400 hover:text-slate-600'}"
					>
						<GlobeIcon class="size-3.5" /> Public
					</button>
					<button
						type="button"
						onclick={() => (draft_visibility = 'followers-only')}
						class="flex items-center gap-1 rounded-full px-2.5 py-1 transition {draft_visibility ===
						'followers-only'
							? 'bg-slate-100 font-semibold text-slate-900'
							: 'text-slate-400 hover:text-slate-600'}"
					>
						<LockIcon class="size-3.5" /> Followers
					</button>
				</div>
			</div>

			<textarea
				bind:value={draft}
				rows="3"
				aria-label="Edit post text"
				class="w-full resize-none border-0 bg-transparent p-0 text-lg leading-relaxed [overflow-wrap:anywhere] break-words text-slate-900 outline-none focus:ring-0"
			></textarea>

			<div class="flex items-center justify-between text-xs">
				<span
					class="tabular-nums {draft.length > MAX_POST_LENGTH
						? 'font-bold text-rose-600'
						: 'text-slate-400'}"
				>
					{MAX_POST_LENGTH - draft.length} characters left
				</span>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => (editing = false)}
						class="px-3 py-1.5 font-medium text-slate-500 transition hover:text-slate-800"
						>Cancel</button
					>
					<button
						type="submit"
						disabled={saving ||
							(draft.trim().length === 0 && !active_post.image_url) ||
							draft.length > MAX_POST_LENGTH}
						class="rounded-full bg-slate-900 px-4 py-1.5 font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
					>
						{saving ? 'Saving…' : 'Save changes'}
					</button>
				</div>
			</div>
		</form>
	{:else}
		{#if active_post.content}
			<p
				class="mt-4 text-lg leading-relaxed [overflow-wrap:anywhere] break-words whitespace-pre-wrap text-slate-900"
			>
				{#each parse_hashtags(active_post.content) as segment, i (i)}
					{#if segment.type === 'tag'}
						<a
							href="{resolve('/explore')}?q={encodeURIComponent(segment.text)}"
							class="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
						>
							{segment.text}
						</a>
					{:else}
						{segment.text}
					{/if}
				{/each}
			</p>
		{/if}
	{/if}

	{#if active_post.image_url}
		<div class="mt-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50">
			<img
				src={active_post.image_url}
				alt="Post attachment"
				class="max-h-[512px] w-full object-cover"
				loading="lazy"
			/>
		</div>
	{/if}

	{#if confirming_delete}
		<div
			class="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-rose-50 p-3 text-sm text-rose-800"
			role="alertdialog"
			aria-label="Confirm delete"
		>
			<span>Delete this post and its comments?</span>
			<span class="flex gap-2">
				<button
					type="button"
					onclick={() => (confirming_delete = false)}
					class="rounded-full px-3 py-1 hover:bg-rose-100">Cancel</button
				>
				<button
					type="button"
					disabled={deleting}
					onclick={confirm_delete}
					class="rounded-full bg-rose-600 px-3 py-1 text-white disabled:opacity-60"
					>{deleting ? 'Deleting…' : 'Delete'}</button
				>
			</span>
		</div>
	{/if}

	<footer class="mt-4 flex items-center gap-5 text-sm text-slate-500">
		<button
			type="button"
			onclick={toggle_like}
			aria-pressed={liked}
			aria-label={liked ? 'Unlike' : 'Like'}
			class="flex items-center gap-1.5 transition enabled:hover:text-rose-600 {liked
				? 'text-rose-600'
				: ''}"
		>
			<HeartIcon class="size-5 {liked ? 'fill-current' : ''}" />
			<span class="tabular-nums" data-testid="like-count">{like_count}</span>
		</button>
		<button
			type="button"
			onclick={() => (comments_override = !show_comments)}
			aria-expanded={show_comments}
			class="flex items-center gap-1.5 hover:text-slate-900"
		>
			<MessageCircleIcon class="size-5" />
			<span class="tabular-nums">{comment_count}</span>
		</button>
	</footer>

	{#if error_message}<p class="mt-2 text-sm text-rose-600" role="alert">{error_message}</p>{/if}

	{#if show_comments}
		<Comments post_id={post.id} on_count={(n) => (comment_override = n)} />
	{/if}
</article>
