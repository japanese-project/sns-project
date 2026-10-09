<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { onMount } from 'svelte'
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
	import GlobeIcon from '@lucide/svelte/icons/globe'
	import XIcon from '@lucide/svelte/icons/x'
	import { get_link_preview, type LinkPreviewData } from '$lib/link-preview-client'

	let {
		url,
		dismissible = false,
		on_dismiss,
		compact = false,
	}: {
		url: string
		dismissible?: boolean
		on_dismiss?: () => void
		compact?: boolean
	} = $props()

	let preview = $state<LinkPreviewData | null>(null)
	let loading = $state(true)
	let image_failed = $state(false)

	onMount(() => {
		let is_active = true
		loading = true

		get_link_preview(url).then((res) => {
			if (!is_active) return
			preview = res
			loading = false
		})

		return () => {
			is_active = false
		}
	})

	let domain = $derived(() => {
		if (preview?.domain) return preview.domain
		try {
			return new URL(url).hostname.replace(/^www\./i, '')
		} catch {
			return url
		}
	})

	let display_url = $derived(() => {
		try {
			const parsed = new URL(url)
			const path = parsed.pathname === '/' ? '' : parsed.pathname
			return (parsed.hostname.replace(/^www\./i, '') + path + parsed.search).slice(0, 48)
		} catch {
			return url.replace(/^https?:\/\//i, '').slice(0, 48)
		}
	})
</script>

{#if loading}
	<a
		href={url}
		target="_blank"
		rel="noopener noreferrer"
		aria-label={url}
		class="relative my-2 flex items-center gap-3 py-1 transition-opacity hover:opacity-80"
		onclick={(e) => e.stopPropagation()}
	>
		<div
			class="size-10 shrink-0 animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-700/70"
		></div>
		<div class="min-w-0 flex-1 space-y-1.5">
			<div class="h-3 w-1/3 animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-700/70"></div>
			<div class="h-3.5 w-3/4 animate-pulse rounded-md bg-slate-200/50 dark:bg-slate-700/50"></div>
		</div>
	</a>
{:else if preview}
	<div class="group relative my-2 overflow-hidden bg-transparent">
		{#if dismissible}
			<button
				type="button"
				onclick={(e) => {
					e.stopPropagation()
					e.preventDefault()
					on_dismiss?.()
				}}
				aria-label="Remove link preview"
				class="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-1 text-white backdrop-blur-xs transition hover:bg-black"
			>
				<XIcon class="size-3.5" />
			</button>
		{/if}

		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={url}
			onclick={(e) => e.stopPropagation()}
			class="block transition-opacity hover:opacity-90"
		>
			{#if preview.image && !image_failed}
				<div
					class="relative w-full overflow-hidden bg-slate-100 dark:bg-slate-800 {compact
						? 'max-h-36 rounded-xl sm:max-h-44'
						: 'max-h-64 rounded-2xl'}"
				>
					<img
						src={preview.image}
						alt={preview.title || 'Link preview image'}
						class="w-full object-cover transition duration-300 group-hover:scale-101"
						loading="lazy"
						onerror={() => (image_failed = true)}
					/>
				</div>
			{/if}

			<div class="py-2 {preview.image && !image_failed ? 'px-0.5' : ''}">
				<!-- Hostname & Link Row -->
				<div class="mb-1 flex items-center gap-1.5 text-xs font-semibold text-indigo-600">
					{#if preview.favicon}
						<img
							src={preview.favicon}
							alt=""
							class="size-3.5 rounded-xs"
							onerror={(e) => ((e.currentTarget as HTMLElement).style.display = 'none')}
						/>
					{:else}
						<GlobeIcon class="size-3.5 text-slate-400" />
					{/if}
					<span class="truncate">{preview.site_name || domain()}</span>
					<span class="text-slate-300">•</span>
					<span class="truncate text-[11px] font-normal text-slate-400 dark:text-slate-500"
						>{display_url()}</span
					>
					<ExternalLinkIcon
						class="ml-auto size-3 opacity-0 transition-opacity group-hover:opacity-100"
					/>
				</div>

				<!-- Title -->
				<h4
					class="line-clamp-2 text-sm font-bold text-slate-900 transition-colors group-hover:text-indigo-600 sm:text-[15px] dark:text-slate-100"
				>
					{preview.title || domain()}
				</h4>

				<!-- Description -->
				{#if preview.description}
					<p class="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
						{preview.description}
					</p>
				{/if}
			</div>
		</a>
	</div>
{:else}
	<!-- Fallback: Clean invisible / borderless link chip -->
	<div class="group relative my-2 overflow-hidden bg-transparent">
		{#if dismissible}
			<button
				type="button"
				onclick={(e) => {
					e.stopPropagation()
					e.preventDefault()
					on_dismiss?.()
				}}
				aria-label="Remove link preview"
				class="absolute top-1 right-1 z-10 rounded-full bg-black/60 p-1 text-white backdrop-blur-xs transition hover:bg-black"
			>
				<XIcon class="size-3" />
			</button>
		{/if}

		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			aria-label={url}
			onclick={(e) => e.stopPropagation()}
			class="flex items-center gap-2 py-1.5 transition-opacity hover:opacity-80"
		>
			<GlobeIcon class="size-4 shrink-0 text-slate-400" />
			<span class="truncate text-xs font-semibold text-indigo-600">{domain()}</span>
			<span class="text-slate-300">•</span>
			<span class="truncate text-[11px] text-slate-400 dark:text-slate-500">{display_url()}</span>
			<ExternalLinkIcon class="ml-auto size-3 text-slate-400 opacity-60" />
		</a>
	</div>
{/if}
