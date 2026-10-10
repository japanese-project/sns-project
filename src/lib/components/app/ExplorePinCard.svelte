<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import { api } from '$lib/api'
	import { parse_content } from '$lib/content'
	import { extract_first_url } from '$lib/link-preview-client'
	import { relative_time } from '$lib/time'
	import type { PostView } from '$lib/types'
	import Avatar from './Avatar.svelte'
	import LinkPreviewCard from './LinkPreviewCard.svelte'
	import HeartIcon from '@lucide/svelte/icons/heart'
	import MessageCircleIcon from '@lucide/svelte/icons/message-circle'
	import LockIcon from '@lucide/svelte/icons/lock'

	let {
		post,
		on_deleted,
	}: {
		post: PostView
		on_deleted?: (id: string) => void
	} = $props()

	let like_override = $state<{ liked: boolean; like_count: number } | null>(null)
	let liked = $derived(like_override?.liked ?? post.liked_by_me)
	let like_count = $derived(like_override?.like_count ?? post.like_count)
	let like_pending = $state(false)

	let preview_url = $derived(post.image_url ? null : extract_first_url(post.content))
	let display_segments = $derived(parse_content(post.content, { exclude_url: preview_url }))
	let post_url = $derived(resolve('/posts/[id]', { id: post.id }))
	let deleting = $state(false)

	async function handle_delete(event: MouseEvent) {
		event.stopPropagation()
		if (deleting || !confirm('Delete this post?')) return
		deleting = true
		try {
			await api(`/api/posts/${post.id}`, { method: 'DELETE' })
			on_deleted?.(post.id)
		} catch {
			/* ignore */
		} finally {
			deleting = false
		}
	}

	async function toggle_like(event: MouseEvent) {
		event.stopPropagation()
		if (like_pending) return
		like_pending = true
		const prev = { liked, like_count }
		const will_like = !liked
		like_override = {
			liked: will_like,
			like_count: like_count + (will_like ? 1 : -1),
		}

		try {
			const res = await api<{ liked: boolean; like_count: number }>(`/api/posts/${post.id}/like`, {
				method: will_like ? 'PUT' : 'DELETE',
			})
			like_override = { liked: res.liked, like_count: res.like_count }
		} catch {
			like_override = prev
		} finally {
			like_pending = false
		}
	}

	function handle_card_click(event: MouseEvent) {
		const target = event.target as HTMLElement
		if (target.closest('a') || target.closest('button')) return
		void goto(post_url as `/${string}`)
	}

	function handle_card_keydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			const target = event.target as HTMLElement
			if (target.closest('a') || target.closest('button')) return
			event.preventDefault()
			void goto(post_url as `/${string}`)
		}
	}
</script>

<div
	role="button"
	tabindex="0"
	onclick={handle_card_click}
	onkeydown={handle_card_keydown}
	class="group mb-2.5 flex cursor-pointer break-inside-avoid flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md sm:mb-4 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
>
	<!-- Visual Media Header (if post has image) -->
	{#if post.image_url}
		<div class="relative w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
			<img
				src={post.image_url}
				alt="Post attachment"
				loading="lazy"
				class="max-h-72 w-full object-cover transition-transform duration-300 group-hover:scale-102"
			/>
		</div>
	{/if}

	<div class="p-2.5 sm:p-3.5">
		<!-- Author Header -->
		<div class="flex items-center justify-between gap-1.5">
			<a
				href={resolve('/u/[handle]', { handle: post.author.username || post.author.id })}
				onclick={(e) => e.stopPropagation()}
				class="group/author flex min-w-0 items-center gap-1.5 sm:gap-2"
			>
				<Avatar user={post.author} size={26} />
				<div class="min-w-0">
					<div class="flex items-center gap-1">
						<span
							class="truncate text-xs font-bold text-slate-900 group-hover/author:text-indigo-600 dark:text-slate-100"
						>
							{post.author.name}
						</span>
						{#if post.visibility === 'followers-only'}
							<LockIcon class="size-2.5 text-slate-400 dark:text-slate-500" />
						{/if}
					</div>
					<span class="block truncate text-[10px] text-slate-400 dark:text-slate-500">
						@{post.author.username || post.author.id}
					</span>
				</div>
			</a>

			<time
				class="shrink-0 text-[10px] text-slate-400 dark:text-slate-500"
				datetime={post.created_at}
			>
				{relative_time(post.created_at)}
			</time>
		</div>

		<!-- Post Body Content -->
		{#if display_segments.length > 0}
			<div class="mt-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
				<div class="line-clamp-6 whitespace-pre-wrap">
					{#each display_segments as segment, i (i)}
						{#if segment.type === 'tag'}
							<a
								href="{resolve('/explore')}?q={encodeURIComponent(segment.text)}"
								onclick={(e) => e.stopPropagation()}
								class="font-semibold text-indigo-600 hover:underline"
							>
								{segment.text}
							</a>
						{:else if segment.type === 'link'}
							<a
								href={segment.href}
								target="_blank"
								rel="noopener noreferrer"
								onclick={(e) => e.stopPropagation()}
								class="font-medium text-indigo-600 hover:underline"
							>
								{segment.text}
							</a>
						{:else}
							{segment.text}
						{/if}
					{/each}
				</div>
			</div>
		{/if}

		<!-- Rich Link Preview Thumbnail (if content contains link & no native image) -->
		{#if preview_url}
			<div class="mt-2.5" onclick={(e) => e.stopPropagation()} role="presentation">
				<LinkPreviewCard url={preview_url} compact={true} />
			</div>
		{/if}
	</div>

	<!-- Bottom Card Actions Bar -->
	<div
		class="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-2.5 py-1.5 text-xs text-slate-500 sm:px-3.5 sm:py-2 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400"
	>
		<div class="flex items-center gap-2 sm:gap-3">
			<!-- Like button -->
			<button
				type="button"
				onclick={toggle_like}
				class="flex items-center gap-1 transition-colors hover:text-rose-600 {liked
					? 'font-semibold text-rose-600'
					: 'text-slate-500'}"
				aria-label={liked ? 'Unlike' : 'Like'}
			>
				<HeartIcon class="size-3.5 {liked ? 'fill-rose-500 text-rose-500' : ''}" />
				<span class="text-[11px]">{like_count > 0 ? like_count : ''}</span>
			</button>

			<!-- Comment count link -->
			<a
				href="{post_url}#comments"
				onclick={(e) => e.stopPropagation()}
				class="flex items-center gap-1 text-slate-500 transition-colors hover:text-indigo-600"
				aria-label="View comments"
			>
				<MessageCircleIcon class="size-3.5" />
				<span class="text-[11px]">{post.comment_count > 0 ? post.comment_count : ''}</span>
			</a>
		</div>

		<div class="flex items-center gap-2">
			{#if post.is_owner}
				<button
					type="button"
					onclick={handle_delete}
					disabled={deleting}
					class="text-[10px] font-medium text-slate-400 transition-colors hover:text-rose-600 dark:text-slate-500"
				>
					{deleting ? 'Deleting…' : 'Delete'}
				</button>
			{/if}
			<a
				href={post_url}
				onclick={(e) => e.stopPropagation()}
				class="text-[10px] font-semibold text-slate-400 transition-colors hover:text-slate-700 dark:text-slate-500"
			>
				View →
			</a>
		</div>
	</div>
</div>
