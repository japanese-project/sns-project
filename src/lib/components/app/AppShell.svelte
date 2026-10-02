<script module lang="ts">
	// Every page renders its own AppShell, so it remounts on each navigation. Keep the last
	// unread count outside the component: a remount reuses it (no flash back to 0) and only
	// re-fetches once it is older than the poll interval. Written only in the browser
	// (onMount / event handlers), so it is never shared between requests during SSR.
	const unread_poll_ms = 60_000
	let unread_cache: { user_id: string; count: number; fetched_at: number } | null = null
</script>

<script lang="ts">
	import { page } from '$app/state'
	import { resolve } from '$app/paths'
	import BellIcon from '@lucide/svelte/icons/bell'
	import CompassIcon from '@lucide/svelte/icons/compass'
	import HouseIcon from '@lucide/svelte/icons/house'
	import LogOutIcon from '@lucide/svelte/icons/log-out'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import PlusIcon from '@lucide/svelte/icons/plus'
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
		children,
	}: {
		user: {
			id: string
			name: string
			image?: string | null
			username?: string | null
			onboarded?: boolean | null
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
			// Badge refresh is best-effort
		}
	}

	// Refresh sources: mount (only if the cached count is stale), a 60s interval, and the
	// `notifications:changed` event. Route changes need no refresh of their own: navigating
	// never changes the count, and a page that does (/notifications) fires the event.
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

	const nav_button =
		'relative flex size-11 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900'
	const active = 'bg-black text-white shadow-xs'
	const idle = 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'

	async function handle_sign_out() {
		await sign_out()
		window.location.href = '/login'
	}
</script>

<svelte:head><title>{title} · SNS</title></svelte:head>

<div class="min-h-screen bg-[#f8fafc] text-slate-900 antialiased">
	<!-- Tablet & Desktop Floating Vertical Navigation Pill -->
	<nav
		aria-label="Primary"
		class="fixed top-1/2 left-4 z-30 hidden -translate-y-1/2 flex-col items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 p-2 shadow-lg shadow-slate-900/5 backdrop-blur-md md:flex lg:left-6"
	>
		<a
			href={resolve('/')}
			onclick={() => {
				if (path === '/') {
					window.dispatchEvent(new CustomEvent('feed:refresh'))
				}
			}}
			title="Home"
			aria-label="Home"
			aria-current={path === '/' ? 'page' : undefined}
			class="{nav_button} {path === '/' ? active : idle}"
		>
			<HouseIcon class="size-5" />
		</a>

		<button
			type="button"
			onclick={() => composer.show()}
			title="Create post"
			aria-label="Create post"
			class="{nav_button} {idle}"
		>
			<PlusIcon class="size-5" />
		</button>

		<a
			href={resolve('/explore')}
			title="Explore"
			aria-label="Explore"
			aria-current={path.startsWith('/explore') ? 'page' : undefined}
			class="{nav_button} {path.startsWith('/explore') ? active : idle}"
		>
			<CompassIcon class="size-5" />
		</a>

		<a
			href={resolve('/notifications')}
			title={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
			aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
			aria-current={path.startsWith('/notifications') ? 'page' : undefined}
			class="{nav_button} {path.startsWith('/notifications') ? active : idle}"
		>
			<BellIcon class="size-5" />
			{#if unread > 0}
				<span
					class="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] leading-4 font-bold text-white shadow-xs"
					data-testid="unread-badge">{unread > 99 ? '99+' : unread}</span
				>
			{/if}
		</a>

		<a
			href={resolve('/u/[handle]', { handle: me_handle })}
			title="Profile"
			aria-label="Profile"
			aria-current={path.startsWith('/u/') && path.split('/')[2] === me_handle ? 'page' : undefined}
			class="{nav_button} {path.split('/')[2] === me_handle && path.startsWith('/u/')
				? active
				: idle}"
		>
			<Avatar {user} size={28} />
		</a>

		<button
			type="button"
			aria-label="Sign out"
			title="Sign out"
			onclick={handle_sign_out}
			class="{nav_button} {idle}"
		>
			<LogOutIcon class="size-4" />
		</button>
	</nav>

	<!-- Mobile Floating Bottom Navigation Pill (< md) -->
	<nav
		aria-label="Mobile navigation"
		class="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/95 p-1.5 shadow-lg shadow-slate-900/10 backdrop-blur-md md:hidden"
	>
		<a
			href={resolve('/')}
			onclick={() => {
				if (path === '/') {
					window.dispatchEvent(new CustomEvent('feed:refresh'))
				}
			}}
			aria-label="Home"
			aria-current={path === '/' ? 'page' : undefined}
			class="{nav_button} {path === '/' ? active : idle}"
		>
			<HouseIcon class="size-5" />
		</a>

		<button
			type="button"
			onclick={() => composer.show()}
			title="Create post"
			aria-label="Create post"
			class="{nav_button} {idle}"
		>
			<PlusIcon class="size-5" />
		</button>

		<a
			href={resolve('/explore')}
			aria-label="Explore"
			aria-current={path.startsWith('/explore') ? 'page' : undefined}
			class="{nav_button} {path.startsWith('/explore') ? active : idle}"
		>
			<CompassIcon class="size-5" />
		</a>

		<a
			href={resolve('/notifications')}
			aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
			aria-current={path.startsWith('/notifications') ? 'page' : undefined}
			class="{nav_button} {path.startsWith('/notifications') ? active : idle}"
		>
			<BellIcon class="size-5" />
			{#if unread > 0}
				<span
					class="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] leading-4 font-bold text-white shadow-xs"
					data-testid="unread-badge">{unread > 99 ? '99+' : unread}</span
				>
			{/if}
		</a>

		<a
			href={resolve('/u/[handle]', { handle: me_handle })}
			aria-label="Profile"
			aria-current={path.startsWith('/u/') && path.split('/')[2] === me_handle ? 'page' : undefined}
			class="{nav_button} {path.split('/')[2] === me_handle && path.startsWith('/u/')
				? active
				: idle}"
		>
			<Avatar {user} size={26} />
		</a>

		<button
			type="button"
			aria-label="Sign out"
			title="Sign out"
			onclick={handle_sign_out}
			class="{nav_button} {idle}"
		>
			<LogOutIcon class="size-4" />
		</button>
	</nav>

	<!-- Content Layout: two-column flex so sidebar starts at the same top as the header -->
	<div class="flex min-h-screen w-full items-start px-3 sm:px-4 md:pr-6 md:pl-20 lg:pr-8 lg:pl-24">
		<!-- Left column: header + main content, centered with max width -->
		<div class="relative min-w-0 flex-1">
			<div class="mx-auto w-full max-w-4xl">
				<!-- Centered Header Pill -->
				<header class="flex justify-center pt-4 pb-2">
					<div
						class="inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/90 p-1.5 shadow-sm shadow-slate-900/5 backdrop-blur-md sm:gap-3.5 sm:px-5 sm:py-2"
					>
						{#if header_content}
							{@render header_content()}
						{:else}
							<h1 class="px-2 text-sm font-bold tracking-tight text-slate-900">{title}</h1>
						{/if}

						<span class="h-4 w-px bg-slate-200"></span>

						<button
							type="button"
							onclick={() => composer.show()}
							class="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:px-2.5"
						>
							<PencilIcon class="size-3.5" />
							<span class="hidden sm:inline">Share a thought…</span>
							<span class="sm:hidden">Post</span>
						</button>
					</div>
				</header>

				<!-- Main Page Content -->
				<main class="w-full pt-2 pb-24 md:pb-12">
					{@render children()}
				</main>
			</div>
		</div>

		<!-- Right column: sidebar — starts at the very top of the page, sticks at header-pill level (top-4 = 16px = pt-4) -->
		{#if right_sidebar}
			<div class="sticky top-4 hidden shrink-0 lg:block" style="width: 320px; margin-left: 2rem;">
				{@render right_sidebar()}
			</div>
		{/if}
	</div>

	{#if composer.open}
		<Composer {user} />
	{/if}

	{#if user.onboarded === false && !onboarding_dismissed}
		<OnboardingModal {user} on_done={() => (onboarding_dismissed = true)} />
	{/if}
</div>
