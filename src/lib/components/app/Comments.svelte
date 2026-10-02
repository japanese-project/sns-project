<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { onMount } from 'svelte'
	import { resolve } from '$app/paths'
	import { api } from '$lib/api'
	import { MAX_COMMENT_LENGTH } from '$lib/limits'
	import { relative_time } from '$lib/time'
	import type { CommentView, UserSummary } from '$lib/types'
	import { parse_content } from '$lib/content'
	import Avatar from './Avatar.svelte'

	let { post_id, on_count }: { post_id: string; on_count: (n: number) => void } = $props()

	let comments = $state<CommentView[]>([])
	let loading = $state(true)
	let load_error = $state<string | null>(null)
	let text = $state('')
	let reply_to = $state<CommentView | null>(null)
	let reply_target_author = $state<UserSummary | null>(null)
	let submitting = $state(false)
	let submit_error = $state<string | null>(null)

	function total(list: CommentView[]) {
		return list.reduce((sum, c) => sum + 1 + c.replies.length, 0)
	}

	async function load() {
		loading = true
		load_error = null
		try {
			comments = (await api<{ items: CommentView[] }>(`/api/posts/${post_id}/comments`)).items
			on_count(total(comments))
		} catch (e) {
			load_error = e instanceof Error ? e.message : 'Could not load comments'
		} finally {
			loading = false
		}
	}

	onMount(load)

	async function submit(event: SubmitEvent) {
		event.preventDefault()
		const content = text.trim()
		if (!content || content.length > MAX_COMMENT_LENGTH || submitting) return
		submitting = true
		submit_error = null
		try {
			const created = await api<CommentView>(`/api/posts/${post_id}/comments`, {
				method: 'POST',
				body: { content, parent_id: reply_to?.id ?? null },
			})
			// Attach parent_author for immediate rendering of @username tag
			const created_with_parent = {
				...created,
				parent_author: reply_to ? (reply_target_author ?? reply_to.author) : null,
			}
			if (created.parent_id) {
				comments.find((c) => c.id === created.parent_id)?.replies.push(created_with_parent)
			} else {
				comments.push(created_with_parent)
			}
			text = ''
			reply_to = null
			reply_target_author = null
			on_count(total(comments))
		} catch (e) {
			// Nothing was added optimistically, so a failure leaves the list and the draft untouched.
			submit_error = e instanceof Error ? e.message : 'Could not post comment'
		} finally {
			submitting = false
		}
	}
	let editing_comment_id = $state<string | null>(null)
	let edit_draft = $state('')
	let saving_edit = $state(false)
	let deleting_comment_id = $state<string | null>(null)

	function start_edit(comment: CommentView) {
		editing_comment_id = comment.id
		edit_draft = comment.content
	}

	function cancel_edit() {
		editing_comment_id = null
		edit_draft = ''
	}

	async function save_comment_edit(comment: CommentView) {
		const val = edit_draft.trim()
		if (!val || val.length > MAX_COMMENT_LENGTH || saving_edit) return
		saving_edit = true
		try {
			const updated = await api<CommentView>(`/api/comments/${comment.id}`, {
				method: 'PATCH',
				body: { content: val },
			})
			comment.content = updated.content
			comment.updated_at = updated.updated_at
			editing_comment_id = null
			edit_draft = ''
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Failed to update comment')
		} finally {
			saving_edit = false
		}
	}

	async function delete_comment_action(comment: CommentView) {
		if (deleting_comment_id === comment.id) return
		deleting_comment_id = comment.id
		try {
			await api(`/api/comments/${comment.id}`, { method: 'DELETE' })
			// Remove from comments list recursively
			function remove_from(list: CommentView[]): boolean {
				const idx = list.findIndex((c) => c.id === comment.id)
				if (idx !== -1) {
					list.splice(idx, 1)
					return true
				}
				for (const c of list) {
					if (remove_from(c.replies)) return true
				}
				return false
			}
			remove_from(comments)
			on_count(total(comments))
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Failed to delete comment')
		} finally {
			deleting_comment_id = null
		}
	}
</script>

{#snippet row(
	comment: CommentView & { parent_author?: UserSummary | null },
	root_parent: CommentView | null,
)}
	{@const is_nested = root_parent !== null}
	{@const target_author = comment.parent_author ?? root_parent?.author}
	{@const is_editing = editing_comment_id === comment.id}
	<li class="flex gap-3 {is_nested ? 'mt-3' : ''}">
		<Avatar user={comment.author} size={is_nested ? 28 : 32} />
		<div class="min-w-0 flex-1">
			<p class="text-sm">
				<a
					href={resolve('/u/[handle]', { handle: comment.author.handle })}
					class="font-semibold text-slate-900 hover:underline">{comment.author.name}</a
				>
				<span class="ml-1 text-xs text-slate-400">{relative_time(comment.created_at)}</span>
				{#if comment.updated_at && comment.updated_at !== comment.created_at}
					<span class="ml-1 text-[0.68rem] text-slate-400">(edited)</span>
				{/if}
			</p>

			{#if is_editing}
				<form
					onsubmit={(e) => {
						e.preventDefault()
						void save_comment_edit(comment)
					}}
					class="mt-1 space-y-2"
				>
					<input
						type="text"
						bind:value={edit_draft}
						maxlength={MAX_COMMENT_LENGTH}
						class="w-full rounded-full border border-slate-200 bg-transparent px-3 py-1 text-sm transition outline-none focus:border-slate-900 focus:ring-0"
					/>
					<div class="flex items-center gap-2 text-xs">
						<button
							type="submit"
							disabled={saving_edit || !edit_draft.trim()}
							class="rounded-full bg-slate-900 px-3 py-1 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
						>
							{saving_edit ? 'Saving…' : 'Save'}
						</button>
						<button
							type="button"
							onclick={cancel_edit}
							class="font-medium text-slate-500 hover:text-slate-800"
						>
							Cancel
						</button>
					</div>
				</form>
			{:else}
				<p class="text-sm [overflow-wrap:anywhere] break-words whitespace-pre-wrap text-slate-700">
					{#if is_nested && target_author?.username}
						<a
							href={resolve('/u/[handle]', { handle: target_author.handle })}
							class="font-medium text-indigo-600 hover:underline">@{target_author.username}</a
						>&nbsp;
					{/if}
					{#each parse_content(comment.content) as segment, i (i)}
						{#if segment.type === 'tag'}
							<a
								href="{resolve('/explore')}?q={encodeURIComponent(segment.text)}"
								class="font-medium text-indigo-600 hover:underline"
								onclick={(e) => e.stopPropagation()}
							>
								{segment.text}
							</a>
						{:else if segment.type === 'link'}
							<a
								href={segment.href}
								target="_blank"
								rel="noopener noreferrer"
								class="font-medium [overflow-wrap:anywhere] break-all text-indigo-600 hover:underline"
								onclick={(e) => e.stopPropagation()}
							>
								{segment.text}
							</a>
						{:else}
							{segment.text}
						{/if}
					{/each}
				</p>
			{/if}

			<div class="mt-0.5 flex items-center gap-3 text-xs">
				{#if !is_editing}
					<button
						type="button"
						onclick={() => {
							reply_to = root_parent ?? comment
							reply_target_author = comment.author
						}}
						class="font-medium text-slate-500 transition hover:text-slate-900"
					>
						{is_nested ? `Reply to ${comment.author.name}` : 'Reply'}
					</button>
				{/if}

				{#if comment.is_owner && !is_editing}
					<button
						type="button"
						onclick={() => start_edit(comment)}
						class="font-medium text-slate-400 transition hover:text-slate-700"
					>
						Edit
					</button>
					<button
						type="button"
						onclick={() => void delete_comment_action(comment)}
						disabled={deleting_comment_id === comment.id}
						class="font-medium text-slate-400 transition hover:text-rose-600 disabled:opacity-50"
					>
						{deleting_comment_id === comment.id ? 'Deleting…' : 'Delete'}
					</button>
				{/if}
			</div>

			{#if !is_nested && comment.replies.length > 0}
				<ul class="mt-2 border-l border-slate-200 pl-3">
					{#each comment.replies as reply (reply.id)}
						{@render row(reply, comment)}
					{/each}
				</ul>
			{/if}
		</div>
	</li>
{/snippet}

<section class="mt-4 border-t border-slate-200 pt-4" aria-label="Comments">
	{#if loading}
		<p class="text-sm text-slate-400">Loading comments…</p>
	{:else if load_error}
		<p class="text-sm text-rose-600" role="alert">
			{load_error} <button type="button" class="underline" onclick={load}>Retry</button>
		</p>
	{:else if comments.length === 0}
		<p class="text-sm text-slate-400">No comments yet.</p>
	{:else}
		<ul class="space-y-4">
			{#each comments as comment (comment.id)}
				{@render row(comment, null)}
			{/each}
		</ul>
	{/if}

	<form onsubmit={submit} class="mt-4 space-y-2">
		{#if reply_to && reply_target_author}
			<p
				class="flex items-center justify-between rounded-full border border-indigo-100 bg-indigo-50/80 px-3.5 py-1 text-xs text-indigo-700"
			>
				<span>
					Replying to <span class="font-bold">{reply_target_author.name}</span>
				</span>
				<button
					type="button"
					onclick={() => {
						reply_to = null
						reply_target_author = null
					}}
					aria-label="Cancel reply"
					class="font-bold hover:text-indigo-900">✕</button
				>
			</p>
		{/if}
		<div class="flex gap-2">
			<input
				bind:value={text}
				placeholder="Write a comment…"
				aria-label="Comment text"
				maxlength={MAX_COMMENT_LENGTH}
				class="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm transition outline-none focus:border-black focus:ring-1 focus:ring-black"
			/>
			<button
				type="submit"
				disabled={submitting || text.trim().length === 0}
				class="shrink-0 rounded-full bg-black px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800 disabled:opacity-50"
				>{submitting ? '…' : 'Send'}</button
			>
		</div>
		{#if submit_error}<p class="text-xs text-rose-600" role="alert">{submit_error}</p>{/if}
	</form>
</section>
