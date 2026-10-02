<script lang="ts">
	import GlobeIcon from '@lucide/svelte/icons/globe'
	import LockIcon from '@lucide/svelte/icons/lock'
	import XIcon from '@lucide/svelte/icons/x'
	import { api } from '$lib/api'
	import { composer } from '$lib/composer-state.svelte'
	import { MAX_POST_LENGTH } from '$lib/limits'
	import type { PostView } from '$lib/types'
	import Avatar from './Avatar.svelte'

	let { user }: { user: { name: string; image?: string | null } } = $props()

	let content = $state('')
	let visibility = $state<'public' | 'followers-only'>('public')
	let submitting = $state(false)
	let error_message = $state<string | null>(null)
	let textarea: HTMLTextAreaElement | undefined = $state()

	import { onMount, onDestroy } from 'svelte'
	import ImageIcon from '@lucide/svelte/icons/image'

	const draft_key = 'composer_draft'

	let selected_image = $state<File | null>(null)
	let image_preview = $state<string | null>(null)
	let image_input: HTMLInputElement | undefined = $state()

	onMount(() => {
		try {
			const draft = localStorage.getItem(draft_key)
			if (draft) content = draft
		} catch {
			// ignore
		}
	})

	onDestroy(() => {
		if (image_preview) URL.revokeObjectURL(image_preview)
	})

	$effect(() => {
		try {
			if (content.trim()) {
				localStorage.setItem(draft_key, content)
			} else {
				localStorage.removeItem(draft_key)
			}
		} catch {
			// ignore
		}
	})

	let remaining = $derived(MAX_POST_LENGTH - content.length)
	let invalid = $derived(
		(content.trim().length === 0 && !selected_image) || content.length > MAX_POST_LENGTH,
	)

	$effect(() => textarea?.focus())

	function discard_draft() {
		content = ''
		remove_image()
		try {
			localStorage.removeItem(draft_key)
		} catch {
			// ignore
		}
	}

	function handle_image_select(e: Event) {
		const target = e.target as HTMLInputElement
		const file = target.files?.[0]
		if (file) {
			selected_image = file
			if (image_preview) URL.revokeObjectURL(image_preview)
			image_preview = URL.createObjectURL(file)
		}
	}

	function remove_image() {
		selected_image = null
		if (image_preview) URL.revokeObjectURL(image_preview)
		image_preview = null
		if (image_input) image_input.value = ''
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault()
		if (invalid || submitting) return
		submitting = true
		error_message = null
		try {
			let image_url: string | undefined

			if (selected_image) {
				const form_data = new FormData()
				form_data.append('image', selected_image)

				const response = await fetch('/api/media', {
					method: 'POST',
					body: form_data,
				})
				if (!response.ok) {
					throw new Error('Failed to upload image')
				}
				const data = (await response.json()) as { url: string }
				image_url = data.url
			}

			const created = await api<PostView>('/api/posts', {
				method: 'POST',
				body: { content, visibility, imageUrl: image_url },
			})
			composer.created(created)
			content = ''
			remove_image()
			try {
				localStorage.removeItem(draft_key)
			} catch {
				// ignore
			}
			composer.hide()
		} catch (e) {
			error_message = e instanceof Error ? e.message : 'Could not publish your post'
		} finally {
			submitting = false
		}
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && composer.hide()} />

<div
	class="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/20 p-4 pt-[15vh] backdrop-blur-md"
	role="presentation"
	onclick={(e) => e.target === e.currentTarget && composer.hide()}
>
	<form
		onsubmit={submit}
		aria-label="New post"
		class="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
	>
		<div class="flex items-center justify-between gap-3">
			<button
				type="button"
				aria-label="Close"
				onclick={() => composer.hide()}
				class="flex size-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 hover:text-slate-900"
			>
				<XIcon class="size-4" />
			</button>

			<div
				class="flex rounded-full bg-slate-100 p-1 text-xs font-medium"
				role="radiogroup"
				aria-label="Who can see this post"
			>
				<button
					type="button"
					role="radio"
					aria-checked={visibility === 'public'}
					onclick={() => (visibility = 'public')}
					class="flex items-center gap-1.5 rounded-full px-3 py-1.5 {visibility === 'public'
						? 'bg-white text-slate-900 shadow-sm'
						: 'text-slate-500'}"
				>
					<GlobeIcon class="size-3.5" /> Public
				</button>
				<button
					type="button"
					role="radio"
					aria-checked={visibility === 'followers-only'}
					onclick={() => (visibility = 'followers-only')}
					class="flex items-center gap-1.5 rounded-full px-3 py-1.5 {visibility === 'followers-only'
						? 'bg-white text-slate-900 shadow-sm'
						: 'text-slate-500'}"
				>
					<LockIcon class="size-3.5" /> Followers
				</button>
			</div>

			<button
				type="submit"
				disabled={invalid || submitting}
				class="rounded-full bg-black px-5 py-2 text-sm font-medium text-white transition enabled:hover:bg-slate-800 disabled:bg-slate-400"
			>
				{submitting ? 'Publishing…' : 'Publish'}
			</button>
		</div>

		<div class="mt-5 flex gap-4">
			<Avatar {user} size={48} />
			<textarea
				bind:this={textarea}
				bind:value={content}
				rows="5"
				placeholder="Share your perspective…"
				aria-label="Post text"
				class="w-full resize-none border-0 bg-transparent p-0 text-lg text-slate-900 placeholder:text-slate-300 focus:ring-0"
			></textarea>
		</div>

		{#if image_preview}
			<div class="relative mt-4 ml-16">
				<img
					src={image_preview}
					alt="Selected preview"
					class="max-h-[300px] rounded-lg object-cover"
				/>
				<button
					type="button"
					onclick={remove_image}
					class="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-slate-900/70 text-white hover:bg-slate-900"
					aria-label="Remove image"
				>
					<XIcon class="size-4" />
				</button>
			</div>
		{/if}

		<div class="mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-sm">
			<div class="flex items-center gap-3">
				<label
					class="-ml-2 flex cursor-pointer items-center justify-center rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-800"
				>
					<ImageIcon class="size-5" />
					<span class="sr-only">Add image</span>
					<input
						type="file"
						accept="image/*"
						class="hidden"
						bind:this={image_input}
						onchange={handle_image_select}
					/>
				</label>
				<p class="min-h-5 text-rose-600" role="alert">{error_message ?? ''}</p>
				{#if content.trim() || selected_image}
					<button
						type="button"
						class="text-xs font-semibold text-slate-400 transition hover:text-slate-800 hover:underline"
						onclick={discard_draft}
					>
						Discard draft
					</button>
				{/if}
			</div>
			<span
				class="tabular-nums {remaining < 0
					? 'text-rose-600'
					: remaining <= 50
						? 'text-amber-600'
						: 'text-slate-400'}"
				aria-live="polite">{remaining}</span
			>
		</div>
	</form>
</div>
