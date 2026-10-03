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
</script>

{#if loading}
	<div
		class="relative my-2.5 flex items-center gap-3 overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-50/50 p-3.5"
	>
		<div class="size-10 shrink-0 animate-pulse rounded-xl bg-slate-200"></div>
		<div class="min-w-0 flex-1 space-y-2">
			<div class="h-3 w-1/3 animate-pulse rounded-md bg-slate-200"></div>
			<div class="h-4 w-3/4 animate-pulse rounded-md bg-slate-200"></div>
		</div>
	</div>
{:else if preview}
	<div
		class="group relative my-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition hover:border-slate-300 hover:shadow-xs"
	>
		{#if dismissible}
			<button
				type="button"
				onclick={(e) => {
					e.stopPropagation()
					e.preventDefault()
					on_dismiss?.()
				}}
				aria-label="Remove link preview"
				class="absolute top-2.5 right-2.5 z-10 rounded-full bg-slate-900/60 p-1 text-white backdrop-blur-xs transition hover:bg-slate-900"
			>
				<XIcon class="size-3.5" />
			</button>
		{/if}

		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer"
			onclick={(e) => e.stopPropagation()}
			class="block transition group-hover:bg-slate-50/40"
		>
			{#if preview.image && !image_failed && !compact}
				<div class="relative max-h-56 w-full overflow-hidden bg-slate-100">
					<img
						src={preview.image}
						alt={preview.title || 'Link preview image'}
						class="w-full object-cover transition duration-300 group-hover:scale-[1.02]"
						loading="lazy"
						onerror={() => (image_failed = true)}
					/>
				</div>
			{/if}

			<div class="p-3.5">
				<!-- Hostname & Icon Row -->
				<div class="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
					{#if preview.favicon}
						<img
							src={preview.favicon}
							alt=""
							class="size-3.5 rounded-xs"
							onerror={(e) => ((e.currentTarget as HTMLElement).style.display = 'none')}
						/>
					{:else}
						<GlobeIcon class="size-3.5 opacity-70" />
					{/if}
					<span class="truncate">{preview.site_name || domain()}</span>
					<ExternalLinkIcon
						class="ml-auto size-3 opacity-0 transition-opacity group-hover:opacity-100"
					/>
				</div>

				<!-- Title -->
				<h4
					class="line-clamp-2 text-sm font-semibold text-slate-900 transition-colors group-hover:text-indigo-600"
				>
					{preview.title || domain()}
				</h4>

				<!-- Description -->
				{#if preview.description}
					<p class="mt-1 line-clamp-2 text-xs text-slate-500">
						{preview.description}
					</p>
				{/if}
			</div>
		</a>
	</div>
{/if}
