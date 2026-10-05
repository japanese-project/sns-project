<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import { api } from '$lib/api'
	import { MAX_POST_LENGTH } from '$lib/limits'
	import { relative_time } from '$lib/time'
	import type { PostView } from '$lib/types'
	import { parse_content } from '$lib/content'
	import { extract_first_url } from '$lib/link-preview-client'
	import Avatar from './Avatar.svelte'
	import Comments from './Comments.svelte'
	import LinkPreviewCard from './LinkPreviewCard.svelte'
	import PostCard from './PostCard.svelte'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import GlobeIcon from '@lucide/svelte/icons/globe'
	import LockIcon from '@lucide/svelte/icons/lock'

	let {
		post,
		initial_open_comments = false,
		on_deleted,
		on_updated,
		on_repost_change,
		my_repost_caption = '',
		embedded = false,
	}: {
		initial_open_comments?: boolean
		post: PostView
		on_deleted?: (id: string) => void
		on_updated?: (post: PostView) => void
		on_repost_change?: (reposted: boolean, caption: string) => void
		/** The signed-in user's existing repost caption, used to prefill "Edit caption". */
		my_repost_caption?: string
		/** Rendered inside a repost: a flat, bordered card instead of a standalone raised one. */
		embedded?: boolean
	} = $props()

	function extract_aspect_ratio_hint(url: string | null | undefined): number | null {
		if (!url) return null
		try {
			const parsed = new URL(url, 'http://localhost')
			const w = Number(parsed.searchParams.get('w'))
			const h = Number(parsed.searchParams.get('h'))
			if (w > 0 && h > 0) return w / h
			const aspect = Number(parsed.searchParams.get('aspect'))
			if (aspect > 0) return aspect
		} catch {
			// ignore
		}
		if (url.startsWith('data:image/svg+xml')) {
			const w_match = url.match(/width=["']?(\d+)/)
			const h_match = url.match(/height=["']?(\d+)/)
			if (w_match && h_match) {
				const w = Number(w_match[1])
				const h = Number(h_match[1])
				if (w > 0 && h > 0) return w / h
			}
			const vb_match = url.match(/viewBox=["']?[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/)
			if (vb_match) {
				const w = Number(vb_match[1])
				const h = Number(vb_match[2])
				if (w > 0 && h > 0) return w / h
			}
		}
		return null
	}

	let post_override = $state<PostView | null>(null)
	let active_post = $derived(post_override ?? post)
	let image_load_failed = $state(false)
	let image_loaded = $state(false)
	let aspect_ratio_hint = $derived(extract_aspect_ratio_hint(active_post.image_url))
	let preview_url = $derived(extract_first_url(active_post.content))
	let display_segments = $derived(parse_content(active_post.content, { exclude_url: preview_url }))
	let natural_aspect_ratio = $state<number | null>(null)
	let effective_aspect_ratio = $derived(natural_aspect_ratio ?? aspect_ratio_hint)

	$effect(() => {
		void active_post.image_url
		image_load_failed = false
		image_loaded = false
		natural_aspect_ratio = null
	})

	function handle_image_load(event: Event) {
		const target = event.currentTarget as HTMLImageElement
		if (target.naturalWidth && target.naturalHeight) {
			natural_aspect_ratio = target.naturalWidth / target.naturalHeight
		}
		image_loaded = true
		image_load_failed = false
	}

	function check_image_cached(node: HTMLImageElement) {
		if (node.complete && node.naturalWidth && node.naturalHeight) {
			natural_aspect_ratio = node.naturalWidth / node.naturalHeight
			image_loaded = true
		}
	}
	let like_override = $state<{ liked: boolean; like_count: number } | null>(null)
	let comment_override = $state<number | null>(null)
	let liked = $derived(like_override?.liked ?? active_post.liked_by_me)
	let like_count = $derived(like_override?.like_count ?? active_post.like_count)
	let comment_count = $derived(comment_override ?? active_post.comment_count)
	let like_pending = $state(false)
	let bookmarked = $derived(active_post.bookmarked_by_me)
	let bookmark_pending = $state(false)
	let reposted = $derived(active_post.reposted_by_me)
	let repost_count = $derived(active_post.repost_count)
	let repost_pending = $state(false)
	let repost_menu_open = $state(false)
	let captioning = $state(false)
	let caption_draft = $state('')
	// Followers-only posts can't be reposted (it would widen their audience); undo stays possible.
	let can_repost = $derived(active_post.visibility === 'public' || reposted)
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
	let copy_status = $state<'idle' | 'copied' | 'failed'>('idle')
	let menu_container_el = $state<HTMLElement | null>(null)
	let menu_button_el = $state<HTMLButtonElement | null>(null)
	let menu_el = $state<HTMLElement | null>(null)

	function close_menu(restore_focus = true) {
		menu_open = false
		if (restore_focus) {
			menu_button_el?.focus()
		}
	}

	function open_menu(focus_target: 'first' | 'last' = 'first') {
		menu_open = true
		queueMicrotask(() => {
			if (!menu_el) return
			const items = Array.from(
				menu_el.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'),
			)
			if (items.length > 0) {
				const item = focus_target === 'first' ? items[0] : items[items.length - 1]
				item?.focus()
			}
		})
	}

	function handle_button_keydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault()
			event.stopPropagation()
			open_menu('first')
		} else if (event.key === 'ArrowUp') {
			event.preventDefault()
			event.stopPropagation()
			open_menu('last')
		}
	}

	function handle_menu_keydown(event: KeyboardEvent) {
		if (!menu_open || !menu_el) return

		const items = Array.from(
			menu_el.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])'),
		)
		if (items.length === 0) return

		const current_index = items.findIndex((item) => item === document.activeElement)

		switch (event.key) {
			case 'ArrowDown': {
				event.preventDefault()
				event.stopPropagation()
				const next_index =
					current_index === -1 || current_index === items.length - 1 ? 0 : current_index + 1
				items[next_index]?.focus()
				break
			}
			case 'ArrowUp': {
				event.preventDefault()
				event.stopPropagation()
				const prev_index = current_index <= 0 ? items.length - 1 : current_index - 1
				items[prev_index]?.focus()
				break
			}
			case 'Home': {
				event.preventDefault()
				event.stopPropagation()
				items[0]?.focus()
				break
			}
			case 'End': {
				event.preventDefault()
				event.stopPropagation()
				items[items.length - 1]?.focus()
				break
			}
			case 'Escape': {
				event.preventDefault()
				event.stopPropagation()
				close_menu(true)
				break
			}
			case 'Tab': {
				close_menu(false)
				break
			}
		}
	}

	$effect(() => {
		if (!menu_open) return
		function handle_doc_click(e: MouseEvent) {
			if (menu_container_el && !menu_container_el.contains(e.target as Node)) {
				close_menu(false)
			}
		}
		function handle_doc_keydown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				close_menu(true)
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
		if (!navigator?.clipboard?.writeText) {
			copy_status = 'failed'
			setTimeout(() => {
				copy_status = 'idle'
			}, 2000)
			return
		}
		try {
			const post_url = `${window.location.origin}${resolve('/posts/[id]', { id: post.id })}`
			await navigator.clipboard.writeText(post_url)
			copy_status = 'copied'
			setTimeout(() => {
				copy_status = 'idle'
				close_menu(true)
			}, 1000)
		} catch {
			copy_status = 'failed'
			setTimeout(() => {
				copy_status = 'idle'
			}, 2000)
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

	// Reposts (optionally with a caption) and undoing one. Optimistic, rolled back on failure.
	async function send_repost(caption?: string) {
		if (repost_pending || !can_repost) return
		const previous = { reposted, repost_count }
		repost_pending = true
		error_message = null
		repost_menu_open = false
		if (!reposted) repost_count += 1
		reposted = true
		try {
			const result = await api<{ reposted: boolean; repost_count: number }>(
				`/api/posts/${post.id}/repost`,
				{ method: 'PUT', body: caption === undefined ? undefined : { content: caption } },
			)
			reposted = result.reposted
			repost_count = result.repost_count
			captioning = false
			on_repost_change?.(true, caption ?? my_repost_caption)
		} catch (e) {
			reposted = previous.reposted
			repost_count = previous.repost_count
			error_message = e instanceof Error ? e.message : 'Could not update repost'
		} finally {
			repost_pending = false
		}
	}

	async function undo_repost() {
		if (repost_pending) return
		const previous = { reposted, repost_count }
		repost_pending = true
		error_message = null
		repost_menu_open = false
		reposted = false
		repost_count -= 1
		try {
			const result = await api<{ reposted: boolean; repost_count: number }>(
				`/api/posts/${post.id}/repost`,
				{ method: 'DELETE' },
			)
			reposted = result.reposted
			repost_count = result.repost_count
			on_repost_change?.(false, '')
		} catch (e) {
			reposted = previous.reposted
			repost_count = previous.repost_count
			error_message = e instanceof Error ? e.message : 'Could not update repost'
		} finally {
			repost_pending = false
		}
	}

	function open_caption_form() {
		repost_menu_open = false
		caption_draft = my_repost_caption
		captioning = true
	}

	$effect(() => {
		if (!repost_menu_open) return
		const close = () => (repost_menu_open = false)
		const on_key = (e: KeyboardEvent) => e.key === 'Escape' && close()
		window.addEventListener('click', close)
		window.addEventListener('keydown', on_key)
		return () => {
			window.removeEventListener('click', close)
			window.removeEventListener('keydown', on_key)
		}
	})

	async function toggle_bookmark() {
		if (bookmark_pending) return
		const previous = bookmarked
		bookmark_pending = true
		error_message = null
		bookmarked = !bookmarked
		try {
			const result = await api<{ bookmarked: boolean }>(`/api/posts/${post.id}/bookmark`, {
				method: bookmarked ? 'PUT' : 'DELETE',
			})
			bookmarked = result.bookmarked
		} catch (e) {
			bookmarked = previous
			error_message = e instanceof Error ? e.message : 'Could not update favorites'
		} finally {
			bookmark_pending = false
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
</script>

{#snippet more_menu()}
	<div class="relative" bind:this={menu_container_el}>
		<button
			type="button"
			aria-label="More options"
			aria-haspopup="menu"
			aria-expanded={menu_open}
			aria-controls={menu_open ? `menu-${post.id}` : undefined}
			bind:this={menu_button_el}
			class="flex size-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
			onkeydown={handle_button_keydown}
			onclick={(e) => {
				e.stopPropagation()
				if (menu_open) close_menu(false)
				else open_menu('first')
			}}
		>
			<i class="ph-bold ph-dots-three text-xl"></i>
		</button>
		{#if menu_open}
			<div
				bind:this={menu_el}
				id="menu-{post.id}"
				role="menu"
				tabindex="-1"
				aria-label="Post actions"
				onkeydown={handle_menu_keydown}
				class="glass-surface absolute top-full right-0 z-50 mt-2 min-w-[155px] overflow-hidden rounded-2xl border border-white/80 py-1.5 shadow-xl shadow-black/10 focus:outline-none"
			>
				<button
					type="button"
					role="menuitem"
					tabindex="-1"
					onclick={handle_copy_link}
					class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-white/50 focus:bg-white/50"
				>
					{#if copy_status === 'copied'}
						<i class="ph-fill ph-check-circle text-base text-emerald-600"></i>
						<span class="text-emerald-600">Copied!</span>
					{:else if copy_status === 'failed'}
						<i class="ph-fill ph-x-circle text-base text-rose-600"></i>
						<span class="text-rose-600">Failed to copy</span>
					{:else}
						<i class="ph ph-copy text-base text-slate-400"></i>
						<span>Copy link</span>
					{/if}
				</button>

				{#if post.is_owner}
					<button
						type="button"
						role="menuitem"
						tabindex="-1"
						onclick={(e) => {
							e.stopPropagation()
							close_menu(false)
							draft = active_post.content
							draft_visibility = active_post.visibility
							editing = true
						}}
						class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-white/50 focus:bg-white/50"
					>
						<i class="ph ph-pencil-simple text-base text-slate-400"></i>
						<span>Edit post</span>
					</button>

					<button
						type="button"
						role="menuitem"
						tabindex="-1"
						onclick={(e) => {
							e.stopPropagation()
							close_menu(false)
							confirming_delete = true
						}}
						class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-rose-600 transition hover:bg-rose-50 focus:bg-rose-50"
					>
						<i class="ph ph-trash text-base text-rose-500"></i>
						<span>Delete post</span>
					</button>
				{/if}
			</div>
		{/if}
	</div>
{/snippet}

{#if post.repost_of}
	<!-- A repost is one card: who reposted (and their caption) on top, the original embedded below. -->
	<div
		class="rounded-3xl border border-slate-100 bg-white p-5 pb-9 shadow-sm sm:p-6 sm:pb-9"
		data-testid="repost"
	>
		<div class="mb-3 flex items-center gap-3">
			<a
				href={resolve('/u/[handle]', { handle: post.author.handle })}
				class="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-80"
			>
				<span class="shrink-0 overflow-hidden rounded-full border border-slate-100">
					<Avatar user={post.author} size={36} />
				</span>
				<span class="flex min-w-0 flex-col leading-tight">
					<span class="flex items-center gap-1.5 text-[15px] font-bold text-slate-900">
						<span class="truncate">{post.is_owner ? 'You' : post.author.name}</span>
						<span
							class="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-600"
						>
							<i class="ph-bold ph-repeat text-sm"></i>
							reposted
						</span>
					</span>
					<span class="mt-0.5 text-[13px] text-slate-500">{relative_time(post.created_at)}</span>
				</span>
			</a>
		</div>
		{#if post.content}
			<p
				class="mb-3 text-[15px] leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap text-slate-800"
				data-testid="repost-caption"
			>
				{#each parse_content(post.content) as segment, i (i)}
					{#if segment.type === 'tag'}
						<a
							href="{resolve('/explore')}?q={encodeURIComponent(segment.text)}"
							class="font-medium text-blue-600 hover:underline">{segment.text}</a
						>
					{:else if segment.type === 'link'}
						<a
							href={segment.href}
							target="_blank"
							rel="noopener noreferrer"
							class="font-medium [overflow-wrap:anywhere] break-all text-blue-600 hover:underline"
							>{segment.text}</a
						>
					{:else}
						{segment.text}
					{/if}
				{/each}
			</p>
		{/if}
		<PostCard
			embedded
			post={post.repost_of}
			{initial_open_comments}
			my_repost_caption={post.is_owner ? post.content : ''}
			on_deleted={() => on_deleted?.(post.id)}
			on_updated={(updated) => on_updated?.({ ...post, repost_of: updated })}
			on_repost_change={(now_reposted, caption) => {
				if (!post.is_owner) return
				// Undoing your own repost removes this item; a new caption updates it in place.
				if (now_reposted) on_updated?.({ ...post, content: caption })
				else on_deleted?.(post.id)
			}}
		/>
	</div>
{:else}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<article
		class="post-card group relative border border-slate-100 {embedded
			? 'rounded-2xl bg-slate-50/60 p-4'
			: 'rounded-3xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6'} {!editing
			? 'cursor-pointer'
			: ''}"
		data-testid="post-card"
		onclick={handle_card_click}
		onkeydown={handle_card_keydown}
	>
		{#if editing}
			<div class="w-full">
				<form onsubmit={save_edit} class="space-y-3">
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
						class="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-[15px] leading-relaxed [overflow-wrap:anywhere] break-words text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
			</div>
		{:else}
			<div class="flex flex-col">
				<!-- Header -->
				<div class="flex items-start justify-between gap-3">
					<button
						class="group/author flex items-center gap-3 text-left transition-opacity hover:opacity-80"
						onclick={(e) => {
							e.stopPropagation()
							goto(
								resolve('/u/[handle]', {
									handle: post.author.handle || post.author.username || post.author.id || 'user',
								}),
							)
						}}
					>
						<div
							class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-100 bg-slate-50"
						>
							<Avatar user={post.author} size={44} />
						</div>
						<div class="flex flex-col leading-tight">
							<span class="text-[15px] font-bold text-slate-900">{post.author.name}</span>
							<span class="mt-0.5 text-[13px] text-slate-500">
								@{post.author.username || post.author.handle || post.author.id} • {relative_time(
									active_post.created_at,
								)}
							</span>
						</div>
					</button>
					{@render more_menu()}
				</div>

				<!-- Text Content -->
				{#if display_segments.length > 0}
					<p
						class="mt-4 text-[15px] leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap text-slate-800"
					>
						{#each display_segments as segment, i (i)}
							{#if segment.type === 'tag'}
								<a
									href="{resolve('/explore')}?q={encodeURIComponent(segment.text)}"
									class="font-medium text-blue-600 hover:underline"
									onclick={(e) => e.stopPropagation()}>{segment.text}</a
								>
							{:else if segment.type === 'link'}
								<a
									href={segment.href}
									target="_blank"
									rel="noopener noreferrer"
									class="font-medium [overflow-wrap:anywhere] break-all text-blue-600 hover:underline"
									onclick={(e) => e.stopPropagation()}>{segment.text}</a
								>
							{:else}
								{segment.text}
							{/if}
						{/each}
					</p>
				{/if}

				<!-- Media -->
				{#if active_post.image_url}
					<div
						data-testid="post-image-container"
						data-aspect-ratio={effective_aspect_ratio}
						class="relative mt-4 flex max-h-[320px] w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 sm:max-h-[400px] md:max-h-[500px]"
						style={effective_aspect_ratio
							? `aspect-ratio: ${effective_aspect_ratio};`
							: 'min-height: 200px;'}
					>
						{#if image_load_failed}
							<div
								data-testid="broken-image-fallback"
								class="flex min-h-[200px] w-full flex-col items-center justify-center gap-2 p-6 text-slate-400"
							>
								<i class="ph ph-image-broken text-3xl"></i>
								<span class="text-xs font-medium">Media unavailable</span>
							</div>
						{:else}
							{#if !image_loaded}
								<div
									class="absolute inset-0 z-0 flex animate-pulse items-center justify-center bg-slate-100 text-slate-300"
								>
									<i class="ph ph-image text-3xl"></i>
								</div>
							{/if}
							<img
								src={active_post.image_url}
								alt=""
								class="absolute inset-0 z-0 h-full w-full scale-110 object-cover opacity-40 blur-xl transition-opacity duration-700 {!image_loaded
									? 'opacity-0'
									: ''}"
								style="position: absolute; width: 100%; height: 100%; object-fit: cover;"
								aria-hidden="true"
							/>
							<img
								src={active_post.image_url}
								alt="Post attachment"
								class="relative z-10 h-full w-full object-contain transition-transform duration-700 hover:scale-[1.02] {!image_loaded
									? 'opacity-0'
									: 'opacity-100'}"
								style="position: relative; width: 100%; height: 100%; object-fit: contain;"
								loading="lazy"
								use:check_image_cached
								onload={handle_image_load}
								onerror={() => {
									image_load_failed = true
									image_loaded = true
								}}
							/>
						{/if}
					</div>
				{/if}

				<!-- Link Preview -->
				{#if preview_url}
					<div class="mt-4">
						<LinkPreviewCard url={preview_url} compact={!!active_post.image_url} />
					</div>
				{/if}

				<!-- Integrated Action Capsule (Floating inside card) -->
				<div
					class="glass-surface absolute right-8 -bottom-7 z-20 flex items-center gap-6 rounded-full border border-white/50 px-5 py-2.5 opacity-100 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 md:-translate-y-2 md:opacity-0"
				>
					<button
						class="group/btn flex items-center gap-2 transition-colors hover:text-system-pink"
						onclick={(e) => {
							e.stopPropagation()
							toggle_like()
						}}
					>
						<i
							class="like-anim text-xl transition-colors {liked
								? 'ph-fill ph-heart scale-110 text-system-pink'
								: 'ph ph-heart text-slate-400 group-hover/btn:text-system-pink'}"
						></i>
						<span
							class="like-count text-sm font-medium text-slate-600 tabular-nums"
							data-testid="like-count">{like_count}</span
						>
					</button>
					<button
						class="group/btn flex items-center gap-2 transition-colors hover:text-black"
						onclick={(e) => {
							e.stopPropagation()
							comments_override = !show_comments
						}}
					>
						<i
							class="ph ph-chat-circle text-xl text-slate-400 transition-colors group-hover/btn:text-black"
						></i>
						<span class="text-sm font-medium text-slate-600">{comment_count}</span>
					</button>
					<div class="relative flex items-center">
						<button
							type="button"
							class="group/btn flex items-center gap-2 transition-colors hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
							aria-label={reposted ? 'Reposted, open repost options' : 'Repost'}
							aria-haspopup="menu"
							aria-expanded={repost_menu_open}
							aria-pressed={reposted}
							title={can_repost ? undefined : 'Only public posts can be reposted'}
							disabled={!can_repost}
							data-testid="repost-button"
							onclick={(e) => {
								e.stopPropagation()
								repost_menu_open = !repost_menu_open
							}}
						>
							<i
								class="ph-bold ph-repeat text-xl transition-colors {reposted
									? 'text-emerald-500'
									: 'text-slate-400 group-hover/btn:text-emerald-600'}"
							></i>
							<span
								class="text-sm font-medium text-slate-600 tabular-nums"
								data-testid="repost-count">{repost_count}</span
							>
						</button>
						{#if repost_menu_open}
							<div
								role="menu"
								aria-label="Repost options"
								class="glass-surface absolute bottom-full left-1/2 z-50 mb-3 min-w-[180px] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/80 py-1.5 shadow-xl shadow-black/10"
							>
								{#if reposted}
									<button
										type="button"
										role="menuitem"
										onclick={(e) => {
											e.stopPropagation()
											open_caption_form()
										}}
										class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-white/50"
									>
										<i class="ph ph-pencil-simple text-base text-slate-400"></i>
										<span>Edit caption</span>
									</button>
									<button
										type="button"
										role="menuitem"
										onclick={(e) => {
											e.stopPropagation()
											undo_repost()
										}}
										class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-rose-600 transition hover:bg-rose-50"
									>
										<i class="ph ph-arrow-u-up-left text-base text-rose-500"></i>
										<span>Undo repost</span>
									</button>
								{:else}
									<button
										type="button"
										role="menuitem"
										onclick={(e) => {
											e.stopPropagation()
											send_repost()
										}}
										class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-white/50"
									>
										<i class="ph ph-repeat text-base text-slate-400"></i>
										<span>Repost</span>
									</button>
									<button
										type="button"
										role="menuitem"
										onclick={(e) => {
											e.stopPropagation()
											open_caption_form()
										}}
										class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-white/50"
									>
										<i class="ph ph-note-pencil text-base text-slate-400"></i>
										<span>Repost with caption</span>
									</button>
								{/if}
							</div>
						{/if}
					</div>
					<button
						type="button"
						class="group/btn flex items-center transition-colors hover:text-amber-500"
						aria-label={bookmarked ? 'Remove from favorites' : 'Add to favorites'}
						aria-pressed={bookmarked}
						data-testid="bookmark-button"
						onclick={(e) => {
							e.stopPropagation()
							toggle_bookmark()
						}}
					>
						<i
							class="text-xl transition-colors {bookmarked
								? 'ph-fill ph-bookmark-simple text-amber-500'
								: 'ph ph-bookmark-simple text-slate-400 group-hover/btn:text-amber-500'}"
						></i>
					</button>
				</div>
			</div>
		{/if}

		{#if captioning}
			<form
				class="mt-8 space-y-2 rounded-2xl bg-slate-50 p-3"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
				onsubmit={(e) => {
					e.preventDefault()
					void send_repost(caption_draft)
				}}
			>
				<textarea
					bind:value={caption_draft}
					rows="2"
					placeholder="Add a caption…"
					aria-label="Repost caption"
					class="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-[15px] leading-relaxed outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
				></textarea>
				<div class="flex items-center justify-between text-xs">
					<span
						class="tabular-nums {caption_draft.length > MAX_POST_LENGTH
							? 'font-bold text-rose-600'
							: 'text-slate-400'}"
					>
						{MAX_POST_LENGTH - caption_draft.length} characters left
					</span>
					<span class="flex items-center gap-2">
						<button
							type="button"
							onclick={() => (captioning = false)}
							class="px-3 py-1.5 font-medium text-slate-500 hover:text-slate-800">Cancel</button
						>
						<button
							type="submit"
							disabled={repost_pending || caption_draft.length > MAX_POST_LENGTH}
							class="rounded-full bg-slate-900 px-4 py-1.5 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
						>
							{reposted ? 'Save caption' : 'Repost'}
						</button>
					</span>
				</div>
			</form>
		{/if}

		{#if confirming_delete}
			<div
				class="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-rose-50 p-3 text-sm text-rose-800"
				role="alertdialog"
			>
				<span>Delete this post and its comments?</span>
				<span class="flex gap-2">
					<button
						type="button"
						onclick={(e) => {
							e.stopPropagation()
							confirming_delete = false
						}}
						class="rounded-full px-3 py-1 hover:bg-rose-100">Cancel</button
					>
					<button
						type="button"
						disabled={deleting}
						onclick={(e) => {
							e.stopPropagation()
							confirm_delete()
						}}
						class="rounded-full bg-rose-600 px-3 py-1 text-white disabled:opacity-60"
						>{deleting ? 'Deleting…' : 'Delete'}</button
					>
				</span>
			</div>
		{/if}

		{#if error_message}<p class="mt-2 text-sm text-rose-600" role="alert">
				{error_message}
			</p>{/if}

		{#if show_comments}
			<div
				class="mt-6 border-t border-slate-100 pt-4"
				onclick={(e) => e.stopPropagation()}
				onkeydown={(e) => e.stopPropagation()}
				role="presentation"
			>
				<Comments post_id={post.id} on_count={(n) => (comment_override = n)} />
			</div>
		{/if}
	</article>
{/if}
