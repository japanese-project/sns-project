<script module lang="ts">
	// Every page renders its own AppShell, so it remounts on each navigation. Keep the last
	// unread count outside the component: a remount reuses it (no flash back to 0) and only
	// re-fetches once it is older than the poll interval. Written only in the browser
	// (onMount / event handlers), so it is never shared between requests during SSR.
	const unread_poll_ms = 60_000
	let unread_cache: { user_id: string; count: number; fetched_at: number } | null = null
</script>

<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { resolve } from '$app/paths'
	import BellIcon from '@lucide/svelte/icons/bell'
	import BotIcon from '@lucide/svelte/icons/bot'
	import CompassIcon from '@lucide/svelte/icons/compass'
	import HouseIcon from '@lucide/svelte/icons/house'
	import LogOutIcon from '@lucide/svelte/icons/log-out'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import { onMount, type Snippet } from 'svelte'
	import { api } from '$lib/api'
	import { sign_out } from '$lib/auth-client'
	import { composer } from '$lib/composer-state.svelte'
	import { t } from '$lib/i18n'
	import Avatar from './Avatar.svelte'
	import Composer from './Composer.svelte'
	import LanguageSelect from './LanguageSelect.svelte'
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
		'relative flex size-11 items-center justify-center rounded-full transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900'
	// Same pill at 40px, so the extra language button still fits a 320px viewport.
	const nav_button_mobile =
		'relative flex size-10 items-center justify-center rounded-full transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 min-[360px]:size-11'
	const active = 'bg-black text-white shadow-xs'
	const idle = 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'

	async function handle_sign_out() {
		await sign_out()
		await goto(resolve('/login'))
	}
</script>

<svelte:head><title>{title} · SNS</title></svelte:head>

<div class="min-h-screen bg-[#f8fafc] text-slate-900 antialiased">
	<!-- ───────────────────────────────────────────────────────────────── -->
	<!-- Tablet & Desktop Floating Vertical Navigation Pill (Floot dock)   -->
	<!-- ───────────────────────────────────────────────────────────────── -->
	<nav
		aria-label={$t('nav.primary')}
		class="fixed top-1/2 left-3 z-40 hidden -translate-y-1/2 flex-col items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 p-2 shadow-lg shadow-slate-900/5 backdrop-blur-md md:flex lg:left-6"
	>
		<a
			href={resolve('/')}
			onclick={() => {
				if (path === '/') {
					window.dispatchEvent(new CustomEvent('feed:refresh'))
				}
			}}
			title={$t('nav.home')}
			aria-label={$t('nav.home')}
			aria-current={path === '/' ? 'page' : undefined}
			class="{nav_button} {path === '/' ? active : idle}"
		>
			<HouseIcon class="size-5" />
		</a>

		<button
			type="button"
			onclick={() => composer.show()}
			title={$t('nav.create_post')}
			aria-label={$t('nav.create_post')}
			class="{nav_button} {idle}"
		>
			<PlusIcon class="size-5" />
		</button>

		<a
			href={resolve('/explore')}
			title={$t('nav.explore')}
			aria-label={$t('nav.explore')}
			aria-current={path.startsWith('/explore') ? 'page' : undefined}
			class="{nav_button} {path.startsWith('/explore') ? active : idle}"
		>
			<CompassIcon class="size-5" />
		</a>

		<a
			href={resolve('/notifications')}
			title={unread > 0
				? $t('nav.notifications_unread', { values: { count: unread } })
				: $t('nav.notifications')}
			aria-label={unread > 0
				? $t('nav.notifications_unread', { values: { count: unread } })
				: $t('nav.notifications')}
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
			title={$t('nav.profile')}
			aria-label={$t('nav.profile')}
			aria-current={path.startsWith('/u/') && path.split('/')[2] === me_handle ? 'page' : undefined}
			class="{nav_button} {path.split('/')[2] === me_handle && path.startsWith('/u/')
				? active
				: idle}"
		>
			<Avatar {user} size={28} />
		</a>

		{#if user.isAdmin}
			<a
				href={resolve('/admin/bots')}
				title={$t('nav.bot_fleet')}
				aria-label={$t('nav.bot_fleet')}
				aria-current={path.startsWith('/admin') ? 'page' : undefined}
				class="{nav_button} {path.startsWith('/admin') ? active : idle}"
			>
				<BotIcon class="size-5" />
			</a>
		{/if}

		<LanguageSelect variant="icon" placement="right" class="{nav_button} {idle}" />

		<button
			type="button"
			aria-label={$t('nav.sign_out')}
			title={$t('nav.sign_out')}
			onclick={handle_sign_out}
			class="{nav_button} {idle} hover:bg-rose-50 hover:text-rose-600"
		>
			<LogOutIcon class="size-4" />
		</button>
	</nav>

	<!-- ───────────────────────────────────────────────────────────────── -->
	<!-- Mobile Floating Bottom Navigation Pill (< md)                    -->
	<!-- ───────────────────────────────────────────────────────────────── -->
	<nav
		aria-label={$t('nav.mobile')}
		class="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-slate-200/90 bg-white/95 p-1.5 shadow-lg shadow-slate-900/10 backdrop-blur-md min-[360px]:gap-1.5 md:hidden"
	>
		<a
			href={resolve('/')}
			onclick={() => {
				if (path === '/') {
					window.dispatchEvent(new CustomEvent('feed:refresh'))
				}
			}}
			aria-label={$t('nav.home')}
			aria-current={path === '/' ? 'page' : undefined}
			class="{nav_button_mobile} {path === '/' ? active : idle}"
		>
			<HouseIcon class="size-5" />
		</a>

		<button
			type="button"
			onclick={() => composer.show()}
			title={$t('nav.create_post')}
			aria-label={$t('nav.create_post')}
			class="{nav_button_mobile} {idle}"
		>
			<PlusIcon class="size-5" />
		</button>

		<a
			href={resolve('/explore')}
			aria-label={$t('nav.explore')}
			aria-current={path.startsWith('/explore') ? 'page' : undefined}
			class="{nav_button_mobile} {path.startsWith('/explore') ? active : idle}"
		>
			<CompassIcon class="size-5" />
		</a>

		<a
			href={resolve('/notifications')}
			aria-label={unread > 0
				? $t('nav.notifications_unread', { values: { count: unread } })
				: $t('nav.notifications')}
			aria-current={path.startsWith('/notifications') ? 'page' : undefined}
			class="{nav_button_mobile} {path.startsWith('/notifications') ? active : idle}"
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
			aria-label={$t('nav.profile')}
			aria-current={path.startsWith('/u/') && path.split('/')[2] === me_handle ? 'page' : undefined}
			class="{nav_button_mobile} {path.split('/')[2] === me_handle && path.startsWith('/u/')
				? active
				: idle}"
		>
			<Avatar {user} size={26} />
		</a>

		{#if user.isAdmin}
			<a
				href={resolve('/admin/bots')}
				aria-label={$t('nav.bot_fleet')}
				aria-current={path.startsWith('/admin') ? 'page' : undefined}
				class="{nav_button_mobile} {path.startsWith('/admin') ? active : idle}"
			>
				<BotIcon class="size-5" />
			</a>
		{/if}

		<LanguageSelect variant="icon" placement="up" class="{nav_button_mobile} {idle}" />
	</nav>

	<!-- ───────────────────────────────────────────────────────────────── -->
	<!-- Content Layout: md:pl-20 lg:pl-24 guarantees dock never overlaps  -->
	<!-- ───────────────────────────────────────────────────────────────── -->
	<div class="flex min-h-screen w-full items-start px-3 sm:px-4 md:pr-6 md:pl-20 lg:pr-8 lg:pl-24">
		<!-- Left / Center column: header + main content -->
		<div class="relative min-w-0 flex-1">
			<div
				class="mx-auto w-full {layout === 'wide'
					? 'max-w-7xl'
					: layout === 'full'
						? 'max-w-full'
						: 'max-w-4xl'}"
			>
				<!-- Centered Sticky Header Pill -->
				<header class="sticky top-3 z-30 flex justify-center pt-1 pb-3 sm:top-4 sm:pt-2 sm:pb-4">
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
							<span class="hidden sm:inline">{$t('nav.share_thought')}</span>
							<span class="sm:hidden">{$t('nav.share_thought_short')}</span>
						</button>
					</div>
				</header>

				<!-- Main Page Content -->
				<main class="w-full pt-1 pb-28 md:pb-16">
					{#if layout === 'default'}
						<div class="mx-auto w-full max-w-2xl">
							{@render children()}
						</div>
					{:else}
						{@render children()}
					{/if}
				</main>
			</div>
		</div>

		<!-- Right column: sidebar — starts at header level, sticks on desktop -->
		{#if right_sidebar}
			<aside
				class="sticky top-4 hidden shrink-0 lg:block xl:ml-8"
				style="width: 320px; margin-left: 1.5rem;"
				aria-label={$t('nav.secondary_sidebar')}
			>
				{@render right_sidebar()}
			</aside>
		{/if}
	</div>

	{#if composer.open}
		<Composer {user} />
	{/if}

	{#if user.onboarded === false && !onboarding_dismissed}
		<OnboardingModal {user} on_done={() => (onboarding_dismissed = true)} />
	{/if}
</div>
