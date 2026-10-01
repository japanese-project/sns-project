<script lang="ts">
	import HeartIcon from '@lucide/svelte/icons/heart'
	import LockIcon from '@lucide/svelte/icons/lock'
	import MessageCircleIcon from '@lucide/svelte/icons/message-circle'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import TrashIcon from '@lucide/svelte/icons/trash'
	import { resolve } from '$app/paths'
	import { api } from '$lib/api'
	import { MAX_POST_LENGTH } from '$lib/limits'
	import { relative_time } from '$lib/time'
	import type { PostView } from '$lib/types'
	import Avatar from './Avatar.svelte'
	import Comments from './Comments.svelte'

	let {
		post,
		signed_in,
		on_deleted,
		on_updated,
	}: {
		post: PostView
		signed_in: boolean
		on_deleted?: (id: string) => void
		on_updated?: (post: PostView) => void
	} = $props()

	// Optimistic like state: an override applied immediately and cleared (rolled back) if the
	// request fails. Without an override the values come straight from the post prop.
	let like_override = $state<{ liked: boolean; like_count: number } | null>(null)
	let comment_override = $state<number | null>(null)
	let liked = $derived(like_override?.liked ?? post.liked_by_me)
	let like_count = $derived(like_override?.like_count ?? post.like_count)
	let comment_count = $derived(comment_override ?? post.comment_count)
	let like_pending = $state(false)
	let show_comments = $state(false)
	let error_message = $state<string | null>(null)

	let editing = $state(false)
	let draft = $state('')
	let draft_visibility = $state<PostView['visibility']>('public')
	let saving = $state(false)
	let confirming_delete = $state(false)
	let deleting = $state(false)

	async function toggle_like() {
		if (!signed_in || like_pending) return
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
		if (saving || draft.trim().length === 0 || draft.length > MAX_POST_LENGTH) return
		saving = true
		error_message = null
		try {
			const updated = await api<PostView>(`/api/posts/${post.id}`, {
				method: 'PATCH',
				body: { content: draft, visibility: draft_visibility },
			})
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
</script>

<article
	class="rounded-[2rem] bg-white/80 p-5 shadow-sm ring-1 ring-slate-200/70 backdrop-blur"
	data-testid="post-card"
>
	<header class="flex items-center gap-3">
		<a
			href={resolve('/u/[handle]', { handle: post.author.handle })}
			aria-label="{post.author.name}'s profile"
		>
			<Avatar user={post.author} size={44} />
		</a>
		<div class="min-w-0 flex-1">
			<a
				href={resolve('/u/[handle]', { handle: post.author.handle })}
				class="block truncate font-semibold text-slate-900 hover:underline">{post.author.name}</a
			>
			<p class="flex items-center gap-1.5 text-xs text-slate-500">
				{#if post.author.username}<span>@{post.author.username}</span><span aria-hidden="true"
						>•</span
					>{/if}
				<time datetime={post.created_at} title={new Date(post.created_at).toLocaleString()}
					>{relative_time(post.created_at)}</time
				>
				{#if post.updated_at !== post.created_at}<span>(edited)</span>{/if}
				{#if post.visibility === 'followers-only'}
					<span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5"
						><LockIcon class="size-3" /> Followers</span
					>
				{/if}
			</p>
		</div>
		{#if post.is_owner && !editing}
			<div class="flex gap-1">
				<button
					type="button"
					aria-label="Edit post"
					onclick={() => {
						draft = post.content
						draft_visibility = post.visibility
						editing = true
					}}
					class="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
					><PencilIcon class="size-4" /></button
				>
				<button
					type="button"
					aria-label="Delete post"
					onclick={() => (confirming_delete = true)}
					class="rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
					><TrashIcon class="size-4" /></button
				>
			</div>
		{/if}
	</header>

	{#if editing}
		<form onsubmit={save_edit} class="mt-4 space-y-3">
			<textarea
				bind:value={draft}
				rows="4"
				aria-label="Edit post text"
				class="w-full resize-none rounded-2xl border-slate-200 bg-white text-slate-900"></textarea>
			<div class="flex items-center justify-between gap-3 text-sm">
				<select
					bind:value={draft_visibility}
					aria-label="Visibility"
					class="rounded-full border-slate-200 py-1.5 text-xs"
				>
					<option value="public">Public</option>
					<option value="followers-only">Followers only</option>
				</select>
				<span
					class="tabular-nums {draft.length > MAX_POST_LENGTH ? 'text-rose-600' : 'text-slate-400'}"
					>{MAX_POST_LENGTH - draft.length}</span
				>
				<div class="flex gap-2">
					<button
						type="button"
						onclick={() => (editing = false)}
						class="rounded-full px-4 py-1.5 text-slate-600 hover:bg-slate-100">Cancel</button
					>
					<button
						type="submit"
						disabled={saving || draft.trim().length === 0 || draft.length > MAX_POST_LENGTH}
						class="rounded-full bg-black px-4 py-1.5 text-white disabled:bg-slate-400"
						>{saving ? 'Saving…' : 'Save'}</button
					>
				</div>
			</div>
		</form>
	{:else}
		<p class="mt-4 text-lg leading-relaxed whitespace-pre-wrap text-slate-900">{post.content}</p>
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
			disabled={!signed_in}
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
			onclick={() => (show_comments = !show_comments)}
			aria-expanded={show_comments}
			class="flex items-center gap-1.5 hover:text-slate-900"
		>
			<MessageCircleIcon class="size-5" />
			<span class="tabular-nums">{comment_count}</span>
		</button>
	</footer>

	{#if error_message}<p class="mt-2 text-sm text-rose-600" role="alert">{error_message}</p>{/if}

	{#if show_comments}
		<Comments post_id={post.id} {signed_in} on_count={(n) => (comment_override = n)} />
	{/if}
</article>
