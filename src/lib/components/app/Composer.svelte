<script lang="ts">
	import GlobeIcon from '@lucide/svelte/icons/globe'
	import LockIcon from '@lucide/svelte/icons/lock'
	import XIcon from '@lucide/svelte/icons/x'
	import ImageIcon from '@lucide/svelte/icons/image'
	import { onMount, onDestroy } from 'svelte'
	import { api } from '$lib/api'
	import { composer } from '$lib/composer-state.svelte'
	import { t } from '$lib/i18n'
	import { MAX_POST_LENGTH, MAX_MEDIA_SIZE_BYTES } from '$lib/limits'
	import type { PostView } from '$lib/types'
	import { extract_first_url } from '$lib/link-preview-client'
	import Avatar from './Avatar.svelte'
	import LinkPreviewCard from './LinkPreviewCard.svelte'

	let { user }: { user: { name: string; image?: string | null } } = $props()

	let content = $state('')
	let visibility = $state<'public' | 'followers-only'>('public')
	let submitting = $state(false)
	let error_message = $state<string | null>(null)
	let textarea: HTMLTextAreaElement | undefined = $state()

	const draft_key = 'composer_draft'

	let selected_image = $state<File | null>(null)
	let image_preview = $state<string | null>(null)
	let image_dims = $state<{ width: number; height: number } | null>(null)
	let image_input: HTMLInputElement | undefined = $state()

	let detected_url = $state<string | null>(null)
	let preview_dismissed = $state(false)

	$effect(() => {
		const url = extract_first_url(content)
		if (url !== detected_url) {
			detected_url = url
			preview_dismissed = false
		}
	})

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
		detected_url = null
		preview_dismissed = false
		try {
			localStorage.removeItem(draft_key)
		} catch {
			// ignore
		}
	}

	function request_close() {
		if (selected_image || (content.trim() && content.trim() !== localStorage.getItem(draft_key))) {
			if (confirm($t('composer.confirm_unsaved'))) {
				remove_image()
				composer.hide()
			}
		} else {
			composer.hide()
		}
	}

	function handle_image_select(e: Event) {
		const target = e.target as HTMLInputElement
		const file = target.files?.[0]
		if (file) {
			if (file.size > MAX_MEDIA_SIZE_BYTES) {
				error_message = $t('composer.image_too_large', {
					values: { size: MAX_MEDIA_SIZE_BYTES / (1024 * 1024) },
				})
				if (image_input) image_input.value = ''
				return
			}
			error_message = null
			selected_image = file
			if (image_preview) URL.revokeObjectURL(image_preview)
			image_preview = URL.createObjectURL(file)
			image_dims = null

			// Pre-calculate image dimensions to provide aspect-ratio hint and prevent feed layout shifts
			const img = new Image()
			img.onload = () => {
				if (img.naturalWidth && img.naturalHeight) {
					image_dims = { width: img.naturalWidth, height: img.naturalHeight }
				}
			}
			img.src = image_preview
		}
	}

	function remove_image() {
		selected_image = null
		image_dims = null
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
					const res_body = (await response.json().catch(() => null)) as { message?: string } | null
					throw new Error(res_body?.message ?? $t('composer.upload_failed'))
				}
				const data = (await response.json()) as { url: string }
				if (image_dims) {
					image_url = `${data.url}?w=${image_dims.width}&h=${image_dims.height}`
				} else {
					image_url = data.url
				}
			}

			const created = await api<PostView>('/api/posts', {
				method: 'POST',
				body: { content, visibility, imageUrl: image_url },
			})
			composer.created(created)
			content = ''
			remove_image()
			detected_url = null
			preview_dismissed = false
			try {
				localStorage.removeItem(draft_key)
			} catch {
				// ignore
			}
			composer.hide()
		} catch (e) {
			error_message = e instanceof Error ? e.message : $t('composer.publish_failed')
		} finally {
			submitting = false
		}
	}

	function adjust_textarea_height() {
		if (textarea) {
			textarea.style.height = 'auto'
			textarea.style.height = textarea.scrollHeight + 'px'
		}
	}
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && request_close()} />

<div
	class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-start sm:p-4 sm:pt-[10vh]"
	role="presentation"
	onclick={(e) => e.target === e.currentTarget && request_close()}
>
	<form
		onsubmit={submit}
		aria-label={$t('composer.label')}
		class="flex max-h-[90vh] w-full max-w-[600px] flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl transition-transform sm:max-h-[85vh] sm:rounded-3xl"
	>
		<!-- Header -->
		<div
			class="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6"
		>
			<button
				type="button"
				aria-label={$t('composer.cancel')}
				onclick={request_close}
				class="text-[15px] font-medium text-slate-500 transition hover:text-slate-900"
			>
				{$t('composer.cancel')}
			</button>

			<h2 class="text-[15px] font-bold tracking-tight text-slate-900">{$t('composer.title')}</h2>

			<button
				type="submit"
				disabled={invalid || submitting}
				class="rounded-full bg-slate-900 px-5 py-1.5 text-sm font-bold text-white shadow-sm transition enabled:hover:bg-black enabled:active:scale-95 disabled:bg-slate-200 disabled:text-slate-400"
			>
				{submitting ? $t('composer.posting') : $t('composer.post')}
			</button>
		</div>

		<!-- Main Content Area -->
		<div class="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
			<div class="flex gap-3 sm:gap-4">
				<div class="shrink-0 pt-1">
					<Avatar {user} size={44} />
				</div>
				<div class="flex min-w-0 flex-1 flex-col">
					<!-- Visibility Toggle -->
					<div class="mb-2">
						<button
							type="button"
							onclick={() => (visibility = visibility === 'public' ? 'followers-only' : 'public')}
							class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 active:scale-95"
						>
							{#if visibility === 'public'}
								<GlobeIcon class="size-3.5 text-indigo-500" />
								<span>{$t('composer.everyone')}</span>
							{:else}
								<LockIcon class="size-3.5 text-amber-500" />
								<span>{$t('composer.followers_only')}</span>
							{/if}
						</button>
					</div>

					<textarea
						bind:this={textarea}
						bind:value={content}
						oninput={adjust_textarea_height}
						rows="4"
						placeholder={$t('composer.placeholder')}
						aria-label={$t('composer.post_text')}
						class="w-full resize-none border-0 bg-transparent p-0 text-[17px] leading-relaxed text-slate-900 placeholder:text-slate-400 focus:ring-0"
					></textarea>

					<!-- Image Preview -->
					{#if image_preview}
						<div class="group relative mt-3 w-fit">
							<img
								src={image_preview}
								alt={$t('composer.attached_media')}
								class="max-h-[320px] max-w-full rounded-2xl border border-slate-100 object-contain shadow-xs"
							/>
							<button
								type="button"
								onclick={remove_image}
								class="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-slate-900/60 text-white backdrop-blur-md transition hover:bg-slate-900 active:scale-95"
								aria-label={$t('composer.remove_image')}
							>
								<XIcon class="size-4" />
							</button>
						</div>
					{/if}

					<!-- Link Preview in Composer -->
					{#if detected_url && !preview_dismissed && !image_preview}
						<div class="mt-3">
							<LinkPreviewCard
								url={detected_url}
								dismissible={true}
								on_dismiss={() => {
									preview_dismissed = true
								}}
							/>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Bottom Action Bar -->
		<div class="shrink-0 border-t border-slate-100 bg-slate-50/50 px-4 py-3 sm:px-6">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<label
						class="flex size-9 cursor-pointer items-center justify-center rounded-full text-indigo-500 transition hover:bg-indigo-50 hover:text-indigo-600 active:scale-95"
					>
						<ImageIcon class="size-[22px]" />
						<span class="sr-only">{$t('composer.add_image')}</span>
						<input
							type="file"
							accept="image/jpeg,image/png,image/webp,image/gif"
							class="hidden"
							bind:this={image_input}
							onchange={handle_image_select}
						/>
					</label>

					{#if error_message}
						<p class="ml-2 text-sm font-medium text-rose-600" role="alert">{error_message}</p>
					{:else if content.trim() || selected_image}
						<button
							type="button"
							class="ml-2 text-[13px] font-semibold text-slate-400 transition hover:text-rose-600"
							onclick={() => {
								if (confirm($t('composer.confirm_discard_draft'))) {
									discard_draft()
								}
							}}
						>
							{$t('composer.discard')}
						</button>
					{/if}
				</div>

				<div class="flex items-center gap-3">
					<div
						class="flex size-8 items-center justify-center rounded-full bg-white text-[11px] font-bold shadow-xs ring-1 ring-slate-200 {remaining <
						0
							? 'text-rose-600 ring-rose-200'
							: remaining <= 50
								? 'text-amber-500 ring-amber-200'
								: 'text-slate-400'}"
						aria-live="polite"
					>
						{remaining}
					</div>
				</div>
			</div>
		</div>
	</form>
</div>
