<script lang="ts">
	import { page } from '$app/state'
	import { resolve } from '$app/paths'
	import BellIcon from '@lucide/svelte/icons/bell'
	import CompassIcon from '@lucide/svelte/icons/compass'
	import HouseIcon from '@lucide/svelte/icons/house'
	import LogInIcon from '@lucide/svelte/icons/log-in'
	import LogOutIcon from '@lucide/svelte/icons/log-out'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import SparklesIcon from '@lucide/svelte/icons/sparkles'
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
		children,
	}: {
		user?: {
			id: string
			name: string
			image?: string | null
			username?: string | null
			onboarded?: boolean | null
		} | null
		title: string
		children: Snippet
	} = $props()

	let unread = $state(0)
	let me_handle = $derived(user ? (user.username ?? user.id) : null)
	let path = $derived(page.url.pathname)
	let onboarding_dismissed = $state(false)

	async function refresh_unread() {
		if (!user) return
		try {
			unread = (await api<{ unread_count: number }>('/api/notifications/unread-count')).unread_count
		} catch {
			// Badge refresh is best-effort
		}
	}

	onMount(() => {
		if (!user) return
		void refresh_unread()
		const timer = setInterval(refresh_unread, 60_000)
		const on_change = () => void refresh_unread()
		window.addEventListener('notifications:changed', on_change)
		return () => {
			clearInterval(timer)
			window.removeEventListener('notifications:changed', on_change)
		}
	})

	$effect(() => {
		void path
		if (user) void refresh_unread()
	})

	async function handle_sign_out() {
		await sign_out()
		window.location.href = '/login'
	}
</script>

<svelte:head><title>{title} · SNS</title></svelte:head>

<div class="min-h-screen bg-slate-50 text-slate-900 antialiased">
	<!-- Layout Shell: dedicated navigation rail + content column -->
	<div class="mx-auto flex min-h-screen w-full max-w-7xl justify-center">
		<!-- Desktop & Tablet Left Navigation Sidebar -->
		<aside
			aria-label="Sidebar navigation"
			class="sticky top-0 z-30 hidden h-screen shrink-0 flex-col justify-between border-r border-slate-200/80 bg-white/70 p-3 backdrop-blur-md md:flex md:w-20 md:items-center xl:w-64 xl:items-stretch xl:p-5"
		>
			<div class="space-y-6">
				<!-- Brand Header -->
				<div class="flex items-center gap-3 px-2 py-1">
					<a
						href={resolve('/')}
						class="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-black text-white shadow-xs transition hover:bg-slate-800"
						aria-label="SNS Home"
					>
						<SparklesIcon class="size-5" />
					</a>
					<span class="hidden text-lg font-black tracking-tight text-slate-900 xl:inline">
						Loop
					</span>
				</div>

				<!-- Navigation Links -->
				<nav class="space-y-1.5" aria-label="Main navigation">
					<a
						href={resolve('/')}
						onclick={() => {
							if (path === '/') {
								window.dispatchEvent(new CustomEvent('feed:refresh'))
							}
						}}
						aria-label="Home"
						aria-current={path === '/' ? 'page' : undefined}
						class="flex items-center gap-3.5 rounded-2xl px-3 py-2.5 text-sm font-semibold transition {path ===
						'/'
							? 'bg-black text-white shadow-xs'
							: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}"
					>
						<HouseIcon class="size-5 shrink-0" />
						<span class="hidden xl:inline">Home</span>
					</a>

					<a
						href={resolve('/explore')}
						aria-label="Explore"
						aria-current={path.startsWith('/explore') ? 'page' : undefined}
						class="flex items-center gap-3.5 rounded-2xl px-3 py-2.5 text-sm font-semibold transition {path.startsWith(
							'/explore',
						)
							? 'bg-black text-white shadow-xs'
							: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}"
					>
						<CompassIcon class="size-5 shrink-0" />
						<span class="hidden xl:inline">Explore</span>
					</a>

					{#if user && me_handle}
						<a
							href={resolve('/notifications')}
							aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
							aria-current={path.startsWith('/notifications') ? 'page' : undefined}
							class="relative flex items-center gap-3.5 rounded-2xl px-3 py-2.5 text-sm font-semibold transition {path.startsWith(
								'/notifications',
							)
								? 'bg-black text-white shadow-xs'
								: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}"
						>
							<div class="relative size-5 shrink-0">
								<BellIcon class="size-5" />
								{#if unread > 0}
									<span
										class="absolute -top-1 -right-1.5 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] leading-4 font-bold text-white shadow-xs"
										data-testid="unread-badge">{unread > 99 ? '99+' : unread}</span
									>
								{/if}
							</div>
							<span class="hidden xl:inline">Notifications</span>
						</a>

						<a
							href={resolve('/u/[handle]', { handle: me_handle })}
							aria-label="Profile"
							aria-current={path.startsWith('/u/') && path.split('/')[2] === me_handle
								? 'page'
								: undefined}
							class="flex items-center gap-3.5 rounded-2xl px-3 py-2.5 text-sm font-semibold transition {path.split(
								'/',
							)[2] === me_handle && path.startsWith('/u/')
								? 'bg-black text-white shadow-xs'
								: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}"
						>
							<div class="shrink-0"><Avatar {user} size={20} /></div>
							<span class="hidden xl:inline">Profile</span>
						</a>
					{/if}
				</nav>

				{#if user}
					<!-- Action Composer button in sidebar -->
					<div class="pt-2">
						<button
							type="button"
							onclick={() => composer.show()}
							class="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-indigo-700"
							aria-label="New post"
						>
							<PlusIcon class="size-5 xl:hidden" />
							<span class="hidden xl:inline">New Post</span>
						</button>
					</div>
				{/if}
			</div>

			<!-- User Footer / Account in sidebar -->
			<div class="border-t border-slate-200/80 pt-4">
				{#if user && me_handle}
					<div class="flex items-center justify-between gap-2">
						<a
							href={resolve('/u/[handle]', { handle: me_handle })}
							class="flex min-w-0 items-center gap-2.5 rounded-2xl p-1.5 transition hover:bg-slate-100"
						>
							<Avatar {user} size={36} />
							<div class="hidden min-w-0 xl:block">
								<p class="truncate text-xs font-bold text-slate-900">{user.name}</p>
								<p class="truncate text-[11px] text-slate-400">@{me_handle}</p>
							</div>
						</a>

						<button
							type="button"
							onclick={handle_sign_out}
							title="Sign out"
							aria-label="Sign out"
							class="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
						>
							<LogOutIcon class="size-4" />
						</button>
					</div>
				{:else}
					<a
						href={resolve('/login')}
						class="flex items-center justify-center gap-2 rounded-2xl bg-black py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800"
					>
						<LogInIcon class="size-4" />
						<span class="hidden xl:inline">Sign In</span>
					</a>
				{/if}
			</div>
		</aside>

		<!-- Main Content Area -->
		<div class="flex min-w-0 flex-1 flex-col">
			<!-- Header -->
			<header
				class="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md sm:h-16 sm:px-6"
			>
				<h1 class="text-base font-bold tracking-tight text-slate-900 sm:text-lg">{title}</h1>

				<div class="flex items-center gap-2 sm:gap-3">
					{#if user}
						<button
							type="button"
							onclick={() => composer.show()}
							class="flex items-center gap-1.5 rounded-full bg-black px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800"
						>
							<PencilIcon class="size-3.5" />
							<span class="hidden sm:inline">Share a thought</span>
							<span class="sm:hidden">Post</span>
						</button>
					{:else}
						<a
							href={resolve('/login')}
							class="rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800"
						>
							Sign in
						</a>
					{/if}
				</div>
			</header>

			<!-- Page Body with Safe Bottom Clearance for Mobile Nav -->
			<main class="min-w-0 flex-1 px-4 py-6 pb-24 sm:px-6 md:pb-12">
				{@render children()}
			</main>
		</div>
	</div>

	<!-- Mobile Bottom Fixed Navigation (< md) -->
	<nav
		aria-label="Mobile navigation"
		class="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-slate-200/90 bg-white/95 px-4 backdrop-blur-md md:hidden"
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
			class="flex size-11 items-center justify-center rounded-2xl transition {path === '/'
				? 'bg-black text-white shadow-xs'
				: 'text-slate-500 hover:text-slate-900'}"
		>
			<HouseIcon class="size-5" />
		</a>

		<a
			href={resolve('/explore')}
			aria-label="Explore"
			aria-current={path.startsWith('/explore') ? 'page' : undefined}
			class="flex size-11 items-center justify-center rounded-2xl transition {path.startsWith(
				'/explore',
			)
				? 'bg-black text-white shadow-xs'
				: 'text-slate-500 hover:text-slate-900'}"
		>
			<CompassIcon class="size-5" />
		</a>

		{#if user && me_handle}
			<a
				href={resolve('/notifications')}
				aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
				aria-current={path.startsWith('/notifications') ? 'page' : undefined}
				class="relative flex size-11 items-center justify-center rounded-2xl transition {path.startsWith(
					'/notifications',
				)
					? 'bg-black text-white shadow-xs'
					: 'text-slate-500 hover:text-slate-900'}"
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
				aria-current={path.startsWith('/u/') && path.split('/')[2] === me_handle
					? 'page'
					: undefined}
				class="flex size-11 items-center justify-center rounded-2xl transition {path.split(
					'/',
				)[2] === me_handle && path.startsWith('/u/')
					? 'bg-black text-white shadow-xs'
					: 'text-slate-500 hover:text-slate-900'}"
			>
				<Avatar {user} size={24} />
			</a>
		{:else}
			<a
				href={resolve('/login')}
				aria-label="Sign in"
				class="flex size-11 items-center justify-center rounded-2xl text-slate-500 hover:text-slate-900"
			>
				<LogInIcon class="size-5" />
			</a>
		{/if}
	</nav>

	{#if user && composer.open}
		<Composer {user} />
	{/if}

	{#if user && user.onboarded === false && !onboarding_dismissed}
		<OnboardingModal {user} on_done={() => (onboarding_dismissed = true)} />
	{/if}
</div>
