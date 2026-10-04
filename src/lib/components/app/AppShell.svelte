<script module lang="ts">
	const unread_poll_ms = 60_000
	let unread_cache: { user_id: string; count: number; fetched_at: number } | null = null
</script>

<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { resolve } from '$app/paths'
	import { onMount, type Snippet } from 'svelte'
	import { api } from '$lib/api'
	import { sign_out } from '$lib/auth-client'
	import { composer } from '$lib/composer-state.svelte'
	import Avatar from './Avatar.svelte'
	import Composer from './Composer.svelte'
	import OnboardingModal from './OnboardingModal.svelte'

	let {
		user,
		title,
		header_content,
		right_sidebar,
		layout = 'default',
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
		layout?: 'default' | 'wide' | 'full'
		children: Snippet
	} = $props()

	let unread = $state(0)
	let me_handle = $derived(user.username ?? user.id)
	let path = $derived(page.url.pathname)
	let onboarding_dismissed = $state(false)

	async function handle_sign_out() {
		await sign_out()
		await goto(resolve('/login'))
	}

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
	class="fixed inset-0 z-10 flex flex-col overflow-hidden bg-slate-50 md:flex-row"
>
	<!-- ───────────────────────────────────────────────────────────────── -->
	<!-- FLAT INSTAGRAM-LIKE LEFT SIDEBAR (Icon rail md/lg, full on xl)   -->
	<!-- ───────────────────────────────────────────────────────────────── -->
	<aside
		class="hidden border-r border-slate-200 bg-white select-none md:flex md:h-full md:w-[72px] md:shrink-0 md:flex-col md:justify-between md:px-2.5 md:py-5 xl:w-60 xl:px-4"
		aria-label="Sidebar navigation"
	>
		<!-- Top Section: Brand + Navigation -->
		<div class="flex flex-col gap-6">
			<!-- Brand Mark / Logo -->
			<a
				href={resolve('/')}
				aria-label="Loop home"
				class="group flex items-center gap-3 rounded-2xl p-2 transition hover:bg-slate-100 active:scale-95 md:justify-center xl:justify-start"
			>
				<span
					class="relative grid size-9 shrink-0 place-items-center rounded-xl bg-[#ff6b4a] shadow-xs transition group-hover:scale-105"
					aria-hidden="true"
				>
					<span class="absolute left-2 size-3 rounded-full border-2 border-white"></span>
					<span class="absolute right-2 size-3 rounded-full border-2 border-white"></span>
				</span>
				<div class="hidden flex-col xl:flex">
					<span class="font-display text-xl leading-none font-bold tracking-tight text-slate-900"
						>Loop</span
					>
					<span class="text-[10px] leading-tight font-medium text-slate-400">Social Network</span>
				</div>
			</a>

			<!-- Navigation Links List -->
			<nav class="flex flex-col gap-1.5" aria-label="Primary navigation">
				<!-- Feed / Home -->
				<a
					href={resolve('/')}
					aria-label="Feed"
					onclick={() => {
						if (path === '/') window.dispatchEvent(new CustomEvent('feed:refresh'))
					}}
					title="Feed"
					class="nav-item group relative flex items-center gap-4 rounded-xl p-2.5 transition md:justify-center xl:justify-start xl:px-3.5 xl:py-3 {path ===
					'/'
						? 'bg-slate-100 font-bold text-slate-900'
						: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
				>
					<i
						class="ph ph-squares-four text-2xl transition-transform group-hover:scale-105 {path ===
						'/'
							? 'ph-fill text-slate-900'
							: 'text-slate-600 group-hover:text-slate-900'}"
					></i>
					<span class="hidden text-sm xl:inline">Feed</span>
				</a>

				<!-- Explore -->
				<a
					href={resolve('/explore')}
					aria-label="Explore"
					title="Explore"
					class="nav-item group relative flex items-center gap-4 rounded-xl p-2.5 transition md:justify-center xl:justify-start xl:px-3.5 xl:py-3 {path.startsWith(
						'/explore',
					)
						? 'bg-slate-100 font-bold text-slate-900'
						: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
				>
					<i
						class="ph text-2xl transition-transform group-hover:scale-105 {path.startsWith(
							'/explore',
						)
							? 'ph-fill ph-compass text-slate-900'
							: 'ph-compass text-slate-600 group-hover:text-slate-900'}"
					></i>
					<span class="hidden text-sm xl:inline">Explore</span>
				</a>

				<!-- Notifications -->
				<a
					href={resolve('/notifications')}
					aria-label="Notifications"
					title="Notifications"
					class="nav-item group relative flex items-center gap-4 rounded-xl p-2.5 transition md:justify-center xl:justify-start xl:px-3.5 xl:py-3 {path.startsWith(
						'/notifications',
					)
						? 'bg-slate-100 font-bold text-slate-900'
						: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
				>
					<div class="relative flex items-center justify-center">
						<i
							class="ph text-2xl transition-transform group-hover:scale-105 {path.startsWith(
								'/notifications',
							)
								? 'ph-fill ph-bell text-slate-900'
								: 'ph-bell text-slate-600 group-hover:text-slate-900'}"
						></i>
						{#if unread > 0}
							<div
								class="absolute -top-1 -right-1 size-2 rounded-full border-2 border-white bg-system-pink"
								data-testid="unread-badge"
							></div>
						{/if}
					</div>
					<span class="hidden text-sm xl:inline">Notifications</span>
					{#if unread > 0}
						<span
							class="ml-auto hidden rounded-full bg-system-pink px-2 py-0.5 text-xs font-bold text-white xl:inline"
						>
							{unread}
						</span>
					{/if}
				</a>

				<!-- Create Post Button (Instagram-like in-flow navigation item) -->
				<button
					type="button"
					aria-label="Create Post"
					title="Create Post"
					onclick={() => composer.show()}
					class="nav-item group relative flex items-center gap-4 rounded-xl p-2.5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 active:scale-95 md:justify-center xl:justify-start xl:px-3.5 xl:py-3"
				>
					<i
						class="ph ph-plus-circle text-2xl transition-transform group-hover:scale-105 group-hover:text-slate-900"
					></i>
					<span class="hidden text-sm xl:inline">Create</span>
				</button>

				<!-- Profile -->
				<a
					href={resolve('/u/[handle]', { handle: me_handle })}
					aria-label="Profile"
					title="Profile"
					class="nav-item group relative flex items-center gap-4 rounded-xl p-2.5 transition md:justify-center xl:justify-start xl:px-3.5 xl:py-3 {path.split(
						'/',
					)[2] === me_handle && path.startsWith('/u/')
						? 'bg-slate-100 font-bold text-slate-900'
						: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
				>
					<div
						class="flex size-6 items-center justify-center overflow-hidden rounded-full border transition group-hover:scale-105 {path.split(
							'/',
						)[2] === me_handle && path.startsWith('/u/')
							? 'border-slate-900 ring-1 ring-slate-900'
							: 'border-slate-300'}"
					>
						<Avatar {user} size={24} />
					</div>
					<span class="hidden text-sm xl:inline">Profile</span>
				</a>

				<!-- Admin / Bots (if admin) -->
				{#if user.isAdmin}
					<a
						href={resolve('/admin/bots')}
						aria-label="Admin"
						title="Bot Fleet"
						class="nav-item group relative flex items-center gap-4 rounded-xl p-2.5 transition md:justify-center xl:justify-start xl:px-3.5 xl:py-3 {path.startsWith(
							'/admin',
						)
							? 'bg-slate-100 font-bold text-slate-900'
							: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
					>
						<i
							class="ph text-2xl transition-transform group-hover:scale-105 {path.startsWith(
								'/admin',
							)
								? 'ph-fill ph-robot text-slate-900'
								: 'ph-robot text-slate-600 group-hover:text-slate-900'}"
						></i>
						<span class="hidden text-sm xl:inline">Bot Fleet</span>
					</a>
				{/if}

				<!-- Settings -->
				<a
					href={resolve('/settings')}
					aria-label="Settings"
					title="Settings"
					class="nav-item group relative flex items-center gap-4 rounded-xl p-2.5 transition md:justify-center xl:justify-start xl:px-3.5 xl:py-3 {path.startsWith(
						'/settings',
					)
						? 'bg-slate-100 font-bold text-slate-900'
						: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
				>
					<i
						class="ph text-2xl transition-transform group-hover:scale-105 {path.startsWith(
							'/settings',
						)
							? 'ph-fill ph-gear text-slate-900'
							: 'ph-gear text-slate-600 group-hover:text-slate-900'}"
					></i>
					<span class="hidden text-sm xl:inline">Settings</span>
				</a>
			</nav>
		</div>

		<!-- Bottom Section: User Footer & Sign out -->
		<div class="border-t border-slate-100 pt-3">
			<!-- Compact icon-only for md/lg -->
			<div class="flex flex-col items-center xl:hidden">
				<button
					type="button"
					aria-label="Sign out"
					title="Sign out"
					onclick={handle_sign_out}
					class="flex size-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 active:scale-95"
				>
					<i class="ph ph-sign-out text-xl"></i>
				</button>
			</div>

			<!-- Full user card for xl -->
			<div
				class="hidden items-center justify-between gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 xl:flex"
			>
				<a
					href={resolve('/u/[handle]', { handle: me_handle })}
					class="flex min-w-0 flex-1 items-center gap-2.5 transition-opacity hover:opacity-80"
				>
					<div class="shrink-0 overflow-hidden rounded-full">
						<Avatar {user} size={32} />
					</div>
					<div class="min-w-0 flex-1 text-left">
						<p class="truncate text-xs leading-tight font-bold text-slate-900">{user.name}</p>
						<p class="truncate text-[11px] leading-tight font-medium text-slate-500">
							@{me_handle}
						</p>
					</div>
				</a>

				<button
					type="button"
					aria-label="Sign out"
					title="Sign out"
					onclick={handle_sign_out}
					class="flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 active:scale-95"
				>
					<i class="ph ph-sign-out text-lg"></i>
				</button>
			</div>
		</div>
	</aside>

	<!-- ───────────────────────────────────────────────────────────────── -->
	<!-- MOBILE FLAT BOTTOM BAR (< md)                                    -->
	<!-- ───────────────────────────────────────────────────────────────── -->
	<aside
		class="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md select-none md:hidden"
		aria-label="Mobile navigation"
	>
		<nav
			class="mx-auto flex h-14 max-w-lg items-center justify-around px-4"
			aria-label="Mobile primary links"
		>
			<a
				href={resolve('/')}
				aria-label="Feed"
				onclick={() => {
					if (path === '/') window.dispatchEvent(new CustomEvent('feed:refresh'))
				}}
				class="flex size-10 items-center justify-center rounded-xl transition {path === '/'
					? 'text-slate-900'
					: 'text-slate-500 hover:text-slate-900'}"
			>
				<i class="ph text-2xl {path === '/' ? 'ph-fill ph-squares-four' : 'ph-squares-four'}"></i>
			</a>

			<a
				href={resolve('/explore')}
				aria-label="Explore"
				class="flex size-10 items-center justify-center rounded-xl transition {path.startsWith(
					'/explore',
				)
					? 'text-slate-900'
					: 'text-slate-500 hover:text-slate-900'}"
			>
				<i class="ph text-2xl {path.startsWith('/explore') ? 'ph-fill ph-compass' : 'ph-compass'}"
				></i>
			</a>

			<!-- Create post (+) button -->
			<button
				type="button"
				aria-label="Create Post"
				onclick={() => composer.show()}
				class="flex size-10 items-center justify-center rounded-xl text-slate-700 transition hover:text-slate-900 active:scale-95"
			>
				<i class="ph ph-plus-circle text-2xl"></i>
			</button>

			<a
				href={resolve('/notifications')}
				aria-label="Notifications"
				class="relative flex size-10 items-center justify-center rounded-xl transition {path.startsWith(
					'/notifications',
				)
					? 'text-slate-900'
					: 'text-slate-500 hover:text-slate-900'}"
			>
				<i class="ph text-2xl {path.startsWith('/notifications') ? 'ph-fill ph-bell' : 'ph-bell'}"
				></i>
				{#if unread > 0}
					<div
						class="absolute top-2 right-2 size-2 rounded-full border-2 border-white bg-system-pink"
						data-testid="unread-badge"
					></div>
				{/if}
			</a>

			<a
				href={resolve('/u/[handle]', { handle: me_handle })}
				aria-label="Profile"
				class="flex size-10 items-center justify-center rounded-xl transition {path.split(
					'/',
				)[2] === me_handle && path.startsWith('/u/')
					? 'text-slate-900'
					: 'text-slate-500'}"
			>
				<div
					class="flex size-6 items-center justify-center overflow-hidden rounded-full border {path.split(
						'/',
					)[2] === me_handle && path.startsWith('/u/')
						? 'border-slate-900 ring-1 ring-slate-900'
						: 'border-slate-300'}"
				>
					<Avatar {user} size={24} />
				</div>
			</a>

			{#if user.isAdmin}
				<a
					href={resolve('/admin/bots')}
					aria-label="Admin"
					class="flex size-10 items-center justify-center rounded-xl transition {path.startsWith(
						'/admin',
					)
						? 'text-slate-900'
						: 'text-slate-500 hover:text-slate-900'}"
				>
					<i class="ph text-2xl {path.startsWith('/admin') ? 'ph-fill ph-robot' : 'ph-robot'}"></i>
				</a>
			{/if}
		</nav>
	</aside>

	<!-- ───────────────────────────────────────────────────────────────── -->
	<!-- MAIN SCROLLABLE CANVAS (Flex-1, responsive padding & centering)  -->
	<!-- ───────────────────────────────────────────────────────────────── -->
	<main
		class="relative h-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto scroll-smooth pt-3 pb-28 md:pt-4 md:pb-12"
		id="scroll-container"
	>
		<!-- Dynamic Island (Top Context Bar) - Centered inside main container -->
		<header
			class="pointer-events-none sticky top-3 z-30 mb-5 flex w-full justify-center px-4 transition-all duration-300 sm:top-4 sm:mb-6"
			id="dynamic-island"
		>
			<div
				class="glass-pill pointer-events-auto flex items-center gap-3 rounded-full border border-white/60 bg-white/80 px-4 py-2 shadow-apple-glass backdrop-blur-2xl sm:gap-4 sm:px-6 sm:py-3 md:gap-6 md:py-3.5"
			>
				{#if header_content}
					<div
						class="flex min-w-[5rem] items-center justify-center text-center text-xs font-semibold tracking-wide text-black/80 sm:min-w-[6rem] sm:text-sm md:text-base"
					>
						{@render header_content()}
					</div>
				{:else}
					<span
						class="min-w-[5rem] text-center text-xs font-semibold tracking-wide text-black/80 sm:min-w-[6rem] sm:text-sm md:text-base"
						>{title}</span
					>
				{/if}
				<div class="h-4 w-[1px] bg-black/10"></div>
				<button
					type="button"
					class="interactive-bounce group flex cursor-pointer items-center gap-2 text-slate-500 transition-colors hover:text-slate-800"
					onclick={() => composer.show()}
				>
					<i
						class="ph ph-pencil-simple text-base transition-colors group-hover:text-slate-800 sm:text-lg"
					></i>
					<span class="hidden text-xs font-medium sm:text-sm md:inline">Share a thought...</span>
				</button>
			</div>
		</header>

		<!-- Container layout: Desktop 2-column feed vs Wide/Full layouts -->
		{#if right_sidebar}
			<div
				class="mx-auto flex w-full max-w-6xl items-start justify-center gap-6 px-3 sm:px-6 lg:gap-8 lg:px-8"
			>
				<!-- Main content area -->
				<div class="view app-view active w-full max-w-2xl min-w-0 flex-1">
					<div class="space-y-8 sm:space-y-10" id="feed-container">
						{@render children()}
					</div>
				</div>

				<!-- Right Sidebar Column (Sticky desktop right sidebar) -->
				<aside
					class="sticky top-5 hidden w-72 shrink-0 lg:block xl:w-80"
					aria-label="Secondary Sidebar"
				>
					{@render right_sidebar()}
				</aside>
			</div>
		{:else}
			<div
				class="mx-auto w-full {layout === 'wide'
					? 'max-w-7xl px-3 sm:px-6 lg:px-8'
					: layout === 'full'
						? 'max-w-full px-3 sm:px-6'
						: 'max-w-2xl px-3 sm:px-4 md:px-0'}"
			>
				<!-- App View Container -->
				<div class="view app-view active">
					<div
						class={layout === 'wide' || layout === 'full' ? 'space-y-6' : 'space-y-8 sm:space-y-10'}
						id="feed-container"
					>
						{@render children()}
					</div>
				</div>
			</div>
		{/if}
	</main>

	{#if composer.open}
		<Composer {user} />
	{/if}

	{#if user.onboarded === false && !onboarding_dismissed}
		<OnboardingModal {user} on_done={() => (onboarding_dismissed = true)} />
	{/if}
</div>
