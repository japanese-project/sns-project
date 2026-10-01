<script lang="ts">
	import { onMount } from 'svelte'
	import { resolve } from '$app/paths'
	import { api } from '$lib/api'
	import { MAX_COMMENT_LENGTH } from '$lib/limits'
	import { relative_time } from '$lib/time'
	import type { CommentView } from '$lib/types'
	import Avatar from './Avatar.svelte'

	let {
		post_id,
		signed_in,
		on_count,
	}: { post_id: string; signed_in: boolean; on_count: (n: number) => void } = $props()

	let comments = $state<CommentView[]>([])
	let loading = $state(true)
	let load_error = $state<string | null>(null)
	let text = $state('')
	let reply_to = $state<CommentView | null>(null)
	let reply_target_name = $state<string | null>(null)
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
			if (created.parent_id) {
				comments.find((c) => c.id === created.parent_id)?.replies.push(created)
			} else {
				comments.push(created)
			}
			text = ''
			reply_to = null
			reply_target_name = null
			on_count(total(comments))
		} catch (e) {
			// Nothing was added optimistically, so a failure leaves the list and the draft untouched.
			submit_error = e instanceof Error ? e.message : 'Could not post comment'
		} finally {
			submitting = false
		}
	}
</script>

{#snippet row(comment: CommentView, root_parent: CommentView | null)}
	{@const is_nested = root_parent !== null}
	<li class="flex gap-3 {is_nested ? 'mt-3' : ''}">
		<Avatar user={comment.author} size={is_nested ? 28 : 32} />
		<div class="min-w-0 flex-1">
			<p class="text-sm">
				<a
					href={resolve('/u/[handle]', { handle: comment.author.handle })}
					class="font-semibold text-slate-900 hover:underline">{comment.author.name}</a
				>
				<span class="ml-1 text-xs text-slate-400">{relative_time(comment.created_at)}</span>
			</p>
			<p class="text-sm whitespace-pre-wrap text-slate-700">
				{#if is_nested && comment.author.username}
					<span class="font-medium text-indigo-600">@{comment.author.username} </span>
				{/if}
				{comment.content}
			</p>
			{#if signed_in}
				<button
					type="button"
					onclick={() => {
						reply_to = root_parent ?? comment
						reply_target_name = comment.author.name
					}}
					class="mt-0.5 text-xs font-medium text-slate-500 hover:text-slate-900"
				>
					{is_nested ? `Reply to ${comment.author.name}` : 'Reply'}
				</button>
			{/if}
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

	{#if signed_in}
		<form onsubmit={submit} class="mt-4 space-y-2">
			{#if reply_to}
				<p
					class="flex items-center justify-between rounded-full border border-indigo-100 bg-indigo-50/80 px-3.5 py-1 text-xs text-indigo-700"
				>
					<span>
						Replying to <span class="font-bold">{reply_target_name ?? reply_to.author.name}</span>
						{#if reply_target_name && reply_target_name !== reply_to.author.name}
							<span class="text-[11px] text-slate-400"> (in thread)</span>
						{/if}
					</span>
					<button
						type="button"
						onclick={() => {
							reply_to = null
							reply_target_name = null
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
	{:else}
		<p class="mt-4 text-center text-xs text-slate-500">
			<a href={resolve('/login')} class="font-medium text-slate-800 underline">Sign in</a> to join the
			conversation.
		</p>
	{/if}
</section>
