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
	<div
		class="my-2.5 flex items-center gap-3 rounded-2xl border border-slate-200/60 bg-slate-50/50 p-3"
	>
		<div class="size-10 shrink-0 animate-pulse rounded-xl bg-slate-200/80"></div>
		<div class="min-w-0 flex-1 space-y-2">
			<div class="h-3 w-1/4 animate-pulse rounded-md bg-slate-200/80"></div>
			<div class="h-4 w-3/4 animate-pulse rounded-md bg-slate-200/60"></div>
		</div>
	</div>
{:else if preview}
	<div class="group relative my-2.5">
		{#if dismissible}
			<button
				type="button"
				onclick={(e) => {
					e.stopPropagation()
					e.preventDefault()
					on_dismiss?.()
				}}
				aria-label="Remove link preview"
				class="absolute top-2.5 right-2.5 z-10 rounded-full bg-slate-900/70 p-1 text-white backdrop-blur-xs transition hover:bg-slate-900"
			>
				<XIcon class="size-3.5" />
			</button>
		{/if}

		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			onclick={(e) => e.stopPropagation()}
			class="block overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
		>
			{#if preview.image && !image_failed}
				<div
					class="relative w-full overflow-hidden bg-slate-100 {compact
						? 'max-h-36 sm:max-h-44'
						: 'max-h-60'}"
				>
					<img
						src={preview.image}
						alt={preview.title || 'Link preview image'}
						class="w-full object-cover transition-transform duration-300 group-hover:scale-102"
						loading="lazy"
						onerror={() => (image_failed = true)}
					/>
				</div>
			{/if}

			<div class="p-3.5 sm:p-4 {preview.image && !image_failed ? 'border-t border-slate-100' : ''}">
				<!-- Hostname & Link Row -->
				<div class="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-indigo-600">
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
					<span class="truncate text-[11px] font-normal text-slate-400">{display_url()}</span>
					<ExternalLinkIcon
						class="ml-auto size-3 text-slate-400 opacity-60 transition-opacity group-hover:text-indigo-600 group-hover:opacity-100"
					/>
				</div>

				<!-- Title -->
				<h4
					class="line-clamp-2 text-sm font-bold text-slate-900 transition-colors group-hover:text-indigo-600 sm:text-[15px]"
				>
					{preview.title || domain()}
				</h4>

				<!-- Description -->
				{#if preview.description}
					<p class="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
						{preview.description}
					</p>
				{/if}
			</div>
		</a>
	</div>
{:else}
	<!-- Fallback: Clean unified link card even if no rich OG metadata was found -->
	<div class="group relative my-2.5">
		{#if dismissible}
			<button
				type="button"
				onclick={(e) => {
					e.stopPropagation()
					e.preventDefault()
					on_dismiss?.()
				}}
				aria-label="Remove link preview"
				class="absolute top-2.5 right-2.5 z-10 rounded-full bg-slate-900/70 p-1 text-white backdrop-blur-xs transition hover:bg-slate-900"
			>
				<XIcon class="size-3.5" />
			</button>
		{/if}

		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			onclick={(e) => e.stopPropagation()}
			class="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
		>
			<div
				class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600"
			>
				<GlobeIcon class="size-5" />
			</div>
			<div class="min-w-0 flex-1">
				<p
					class="truncate text-xs font-semibold text-slate-900 transition-colors group-hover:text-indigo-600"
				>
					{domain()}
				</p>
				<p class="truncate text-[11px] text-slate-400">
					{display_url()}
				</p>
			</div>
			<ExternalLinkIcon
				class="size-4 shrink-0 text-slate-400 transition-colors group-hover:text-indigo-600"
			/>
		</a>
	</div>
{/if}
