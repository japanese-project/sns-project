<script lang="ts">
	import HeartIcon from '@lucide/svelte/icons/heart'
	import LockIcon from '@lucide/svelte/icons/lock'
	import MessageCircleIcon from '@lucide/svelte/icons/message-circle'
	import TrashIcon from '@lucide/svelte/icons/trash-2'
	import { resolve } from '$app/paths'
	import { api } from '$lib/api'
	import { relative_time } from '$lib/time'
	import type { PostView } from '$lib/types'
	import Avatar from './Avatar.svelte'
	import Comments from './Comments.svelte'

	let {
		post,
		signed_in,
		on_deleted,
	}: {
		post: PostView
		signed_in: boolean
		on_deleted?: (id: string) => void
	} = $props()

	let like_override = $state<{ liked: boolean; like_count: number } | null>(null)
	let comment_override = $state<number | null>(null)
	let liked = $derived(like_override?.liked ?? post.liked_by_me)
	let like_count = $derived(like_override?.like_count ?? post.like_count)
	let comment_count = $derived(comment_override ?? post.comment_count)
	let like_pending = $state(false)
	let show_comments = $state(false)

	let confirming_delete = $state(false)
	let deleting = $state(false)
	let error_message = $state<string | null>(null)

	async function toggle_like() {
		if (!signed_in || like_pending) return
		const next_liked = !liked
		like_pending = true
		error_message = null
		like_override = { liked: next_liked, like_count: like_count + (next_liked ? 1 : -1) }
		try {
			const result = await api<{ liked: boolean; like_count: number }>(
				`/api/posts/${post.id}/like`,
				{
					method: next_liked ? 'PUT' : 'DELETE',
				},
			)
			like_override = result
		} catch (e) {
			like_override = null
			error_message = e instanceof Error ? e.message : 'Could not update like'
		} finally {
			like_pending = false
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
				{#if post.visibility === 'followers-only'}
					<span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5"
						><LockIcon class="size-3" /> Followers</span
					>
				{/if}
			</p>
		</div>
		{#if post.is_owner}
			<div class="flex gap-1">
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

	<div class="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap text-slate-800">
		{post.content}
	</div>

	{#if post.image_url}
		<img
			src={post.image_url}
			alt=""
			class="mt-3 max-h-96 w-full rounded-2xl object-cover ring-1 ring-slate-200"
			loading="lazy"
		/>
	{/if}

	{#if confirming_delete}
		<div
			class="mt-4 flex items-center justify-between rounded-2xl bg-rose-50 p-3 text-sm text-rose-800"
		>
			<span>Delete this post permanently?</span>
			<div class="flex gap-2">
				<button
					type="button"
					disabled={deleting}
					onclick={() => (confirming_delete = false)}
					class="rounded-full px-3 py-1 text-slate-600 hover:bg-white/80">Cancel</button
				>
				<button
					type="button"
					disabled={deleting}
					onclick={confirm_delete}
					class="rounded-full bg-rose-600 px-3 py-1 text-white hover:bg-rose-700 disabled:opacity-50"
					>{deleting ? 'Deleting…' : 'Delete'}</button
				>
			</div>
		</div>
	{/if}

	{#if error_message}
		<p class="mt-2 text-xs text-rose-600" role="alert">{error_message}</p>
	{/if}

	<footer class="mt-4 flex items-center gap-6 border-t border-slate-100 pt-3 text-slate-500">
		<button
			type="button"
			onclick={toggle_like}
			disabled={!signed_in || like_pending}
			aria-label={liked ? 'Unlike' : 'Like'}
			aria-pressed={liked}
			class="flex items-center gap-1.5 text-sm transition hover:text-rose-600 disabled:opacity-60 {liked
				? 'text-rose-600'
				: ''}"
		>
			<HeartIcon class="size-4 {liked ? 'fill-current text-rose-600' : ''}" />
			<span data-testid="like-count">{like_count}</span>
		</button>

		<button
			type="button"
			onclick={() => (show_comments = !show_comments)}
			aria-expanded={show_comments}
			aria-label="Comments"
			class="flex items-center gap-1.5 text-sm transition hover:text-slate-900"
		>
			<MessageCircleIcon class="size-4" />
			<span>{comment_count}</span>
		</button>
	</footer>

	{#if show_comments}
		<div class="mt-4 border-t border-slate-100 pt-4">
			<Comments post_id={post.id} {signed_in} on_count={(n) => (comment_override = n)} />
		</div>
	{/if}
</article>
