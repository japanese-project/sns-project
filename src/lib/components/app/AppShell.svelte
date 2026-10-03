<script module lang="ts">
	const unread_poll_ms = 60_000
	let unread_cache: { user_id: string; count: number; fetched_at: number } | null = null
</script>

<script lang="ts">
	import { page } from '$app/state'
	import { resolve } from '$app/paths'
	import { onMount, type Snippet } from 'svelte'
	import { api } from '$lib/api'
	import { composer } from '$lib/composer-state.svelte'
	import Avatar from './Avatar.svelte'
	import Composer from './Composer.svelte'
	import OnboardingModal from './OnboardingModal.svelte'

	let {
		user,
		title,
		header_content,
		right_sidebar,
		children,
	}: {
		user: {
			id: string
			name: string
			image?: string | null
			username?: string | null
			onboarded?: boolean | null
			isAdmin?: boolean
		}
		title: string
		header_content?: Snippet
		right_sidebar?: Snippet
		children: Snippet
	} = $props()

	let unread = $state(0)
	let me_handle = $derived(user.username ?? user.id)
	let path = $derived(page.url.pathname)
	let onboarding_dismissed = $state(false)

	async function refresh_unread() {
		try {
			const count = (await api<{ unread_count: number }>('/api/notifications/unread-count'))
				.unread_count
			unread = count
			unread_cache = { user_id: user.id, count, fetched_at: Date.now() }
		} catch {
			/* ignore */
		}
	}

	onMount(() => {
		const fresh =
			unread_cache?.user_id === user.id && Date.now() - unread_cache.fetched_at < unread_poll_ms
		if (unread_cache?.user_id === user.id) unread = unread_cache.count
		if (!fresh) void refresh_unread()
		const timer = setInterval(refresh_unread, unread_poll_ms)
		const on_change = () => void refresh_unread()
		window.addEventListener('notifications:changed', on_change)
		return () => {
			clearInterval(timer)
			window.removeEventListener('notifications:changed', on_change)
		}
	})


</script>

<svelte:head><title>{title} · SNS</title></svelte:head>

<div class="ambient-bg">
	<div class="ambient-blob blob-1"></div>
	<div class="ambient-blob blob-2"></div>
	<div class="ambient-blob blob-3"></div>
</div>

<div
	id="app-shell"
	class="fixed inset-0 z-10 flex flex-col transition-all duration-700 md:flex-row"
>
	<!-- Spatial Dock (Desktop: Left vertically centered, Mobile: Bottom horizontally centered) -->
	<nav
		class="glass-surface fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 flex-row items-center gap-2 rounded-full p-2 shadow-apple-panel backdrop-blur-3xl md:top-1/2 md:left-6 md:translate-x-0 md:-translate-y-1/2 md:flex-col"
	>
		<!-- Nav Items -->
		<a
			href={resolve('/')}
			aria-label="Feed"
			onclick={() => {
				if (path === '/') window.dispatchEvent(new CustomEvent('feed:refresh'))
			}}
			class="nav-item group interactive-bounce relative mx-1 flex h-12 w-12 items-center justify-center rounded-full transition-all hover:bg-white/80 md:mx-0 md:h-14 md:w-14 {path ===
			'/'
				? 'active bg-white/60 shadow-sm'
				: ''}"
		>
			<i
				class="ph ph-squares-four text-2xl {path === '/'
					? 'ph-fill text-black'
					: 'text-slate-600 transition-colors group-hover:text-black'}"
			></i>
			<div
				class="absolute bottom-0 h-1.5 w-1.5 rounded-full bg-black transition-opacity md:top-1/2 md:bottom-auto md:-left-3 md:-translate-y-1/2 {path ===
				'/'
					? 'opacity-100'
					: 'opacity-0 group-[.active]:opacity-100'}"
			></div>
		</a>

		<a
			href={resolve('/explore')}
			aria-label="Explore"
			class="nav-item group interactive-bounce relative mx-1 flex h-12 w-12 items-center justify-center rounded-full transition-all hover:bg-white/80 md:mx-0 md:h-14 md:w-14 {path.startsWith(
				'/explore',
			)
				? 'active bg-white/60 shadow-sm'
				: ''}"
		>
			<i
				class="ph ph-compass text-2xl {path.startsWith('/explore')
					? 'ph-fill text-black'
					: 'text-slate-600 transition-colors group-hover:text-black'}"
			></i>
			<div
				class="absolute bottom-0 h-1.5 w-1.5 rounded-full bg-black transition-opacity md:top-1/2 md:bottom-auto md:-left-3 md:-translate-y-1/2 {path.startsWith(
					'/explore',
				)
					? 'opacity-100'
					: 'opacity-0 group-[.active]:opacity-100'}"
			></div>
		</a>

		<button
			aria-label="Create Post"
			onclick={() => composer.show()}
			class="group interactive-bounce mx-1 flex h-12 w-12 items-center justify-center rounded-full bg-black text-white shadow-lg transition-transform hover:scale-105 active:scale-95 md:mx-0 md:my-2 md:h-14 md:w-14"
		>
			<i class="ph ph-plus text-xl md:text-2xl"></i>
		</button>

		<a
			href={resolve('/notifications')}
			aria-label="Notifications"
			class="nav-item group interactive-bounce relative mx-1 flex h-12 w-12 items-center justify-center rounded-full transition-all hover:bg-white/80 md:mx-0 md:h-14 md:w-14 {path.startsWith(
				'/notifications',
			)
				? 'active bg-white/60 shadow-sm'
				: ''}"
		>
			<div class="relative">
				<i
					class="ph ph-bell text-2xl {path.startsWith('/notifications')
						? 'ph-fill text-black'
						: 'text-slate-600 transition-colors group-hover:text-black'}"
				></i>
				{#if unread > 0}
					<div
						class="0 absolute right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-system-pink"
						data-testid="unread-badge"
					></div>
				{/if}
			</div>
			<div
				class="absolute bottom-0 h-1.5 w-1.5 rounded-full bg-black transition-opacity md:top-1/2 md:bottom-auto md:-left-3 md:-translate-y-1/2 {path.startsWith(
					'/notifications',
				)
					? 'opacity-100'
					: 'opacity-0 group-[.active]:opacity-100'}"
			></div>
		</a>

		<a
			href={resolve('/u/[handle]', { handle: me_handle })}
			aria-label="Profile"
			class="nav-item group interactive-bounce relative mx-1 flex h-12 w-12 items-center justify-center rounded-full transition-all hover:bg-white/80 md:mx-0 md:mt-4 md:h-14 md:w-14 {path.split(
				'/',
			)[2] === me_handle && path.startsWith('/u/')
				? 'active bg-white/60 shadow-sm'
				: ''}"
		>
			<!-- Apply similar styling to avatar to fit dock -->
			<div
				class="rounded-full border-2 {path.split('/')[2] === me_handle && path.startsWith('/u/')
					? 'border-black'
					: 'border-transparent group-[.active]:border-black'} flex items-center justify-center overflow-hidden transition-all"
				style="width: 2.5rem; height: 2.5rem;"
			>
				<Avatar {user} size={40} />
			</div>
			<div
				class="absolute bottom-0 h-1.5 w-1.5 rounded-full bg-black transition-opacity md:top-1/2 md:bottom-auto md:-left-3 md:-translate-y-1/2 {path.split(
					'/',
				)[2] === me_handle && path.startsWith('/u/')
					? 'opacity-100'
					: 'opacity-0 group-[.active]:opacity-100'}"
			></div>
		</a>

		{#if user.isAdmin}
			<a
				href={resolve('/admin/bots')}
				aria-label="Admin"
				class="nav-item group interactive-bounce relative mx-1 hidden h-12 w-12 items-center justify-center rounded-full transition-all hover:bg-white/80 md:mx-0 md:flex md:h-14 md:w-14 {path.startsWith(
					'/admin',
				)
					? 'active bg-white/60 shadow-sm'
					: ''}"
			>
				<i
					class="ph ph-robot text-2xl {path.startsWith('/admin')
						? 'ph-fill text-black'
						: 'text-slate-600 transition-colors group-hover:text-black'}"
				></i>
				<div
					class="absolute bottom-0 h-1.5 w-1.5 rounded-full bg-black transition-opacity md:top-1/2 md:bottom-auto md:-left-3 md:-translate-y-1/2 {path.startsWith(
						'/admin',
					)
						? 'opacity-100'
						: 'opacity-0 group-[.active]:opacity-100'}"
				></div>
			</a>
		{/if}
	</nav>

	<!-- Main Scrollable Canvas -->
	<main
		class="relative h-full w-full flex-1 overflow-x-hidden overflow-y-auto scroll-smooth pt-20 pb-32 md:pt-28"
		id="scroll-container"
	>
		<!-- Dynamic Island (Top Context Bar) -->
		<header
			class="fixed top-6 left-1/2 z-30 flex -translate-x-1/2 items-center justify-center transition-all duration-500"
			id="dynamic-island"
		>
			<div
				class="glass-pill flex items-center gap-4 rounded-full px-6 py-3 shadow-apple-glass md:gap-6 md:py-4"
			>
				{#if header_content}
					<div
						class="flex min-w-[6rem] items-center justify-center text-center text-sm font-semibold tracking-wide text-black/80 md:text-base"
					>
						{@render header_content()}
					</div>
				{:else}
					<span
						class="min-w-[6rem] text-center text-sm font-semibold tracking-wide text-black/80 md:text-base"
						>{title}</span
					>
				{/if}
				<div class="h-4 w-[1px] bg-black/10"></div>
				<button
					type="button"
					class="interactive-bounce group flex cursor-pointer items-center gap-2 text-slate-500 transition-colors hover:text-slate-800"
					onclick={() => composer.show()}
				>
					<i class="ph ph-pencil-simple text-lg transition-colors group-hover:text-slate-800"></i>
					<span class="hidden text-sm font-medium md:inline">Share a thought...</span>
				</button>
			</div>
		</header>

		<!-- Centered constraints for single-column immersive feel -->
		<div class="mx-auto w-full max-w-2xl px-4 md:px-0">
			<!-- App View Container -->
			<div class="view app-view active">
				<div class="space-y-10" id="feed-container">
					{@render children()}
				</div>
			</div>

			{#if right_sidebar}
				<div class="mt-12 scale-95 opacity-80 transition-all hover:scale-100 hover:opacity-100">
					{@render right_sidebar()}
				</div>
			{/if}
		</div>
	</main>

	{#if composer.open}
		<Composer {user} />
	{/if}

	{#if user.onboarded === false && !onboarding_dismissed}
		<OnboardingModal {user} on_done={() => (onboarding_dismissed = true)} />
	{/if}
</div>
