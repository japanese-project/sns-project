<script lang="ts">
	import { page } from '$app/state'
	import { resolve } from '$app/paths'
	import BellIcon from '@lucide/svelte/icons/bell'
	import CompassIcon from '@lucide/svelte/icons/compass'
	import HouseIcon from '@lucide/svelte/icons/house'
	import LogOutIcon from '@lucide/svelte/icons/log-out'
	import { onMount, type Snippet } from 'svelte'
	import { api } from '$lib/api'
	import { sign_out } from '$lib/auth-client'
	import Avatar from './Avatar.svelte'

	let {
		user,
		title,
		children,
	}: {
		user: { id: string; name: string; image?: string | null; username?: string | null }
		title: string
		children: Snippet
	} = $props()

	let unread = $state(0)
	let me_handle = $derived(user.username ?? user.id)
	let path = $derived(page.url.pathname)

	async function refresh_unread() {
		try {
			unread = (await api<{ unread_count: number }>('/api/notifications/unread-count')).unread_count
		} catch {
			// The badge is best-effort; the notifications page surfaces real errors.
		}
	}

	onMount(() => {
		void refresh_unread()
		const timer = setInterval(refresh_unread, 60_000)
		const on_change = () => void refresh_unread()
		window.addEventListener('notifications:changed', on_change)
		return () => {
			clearInterval(timer)
			window.removeEventListener('notifications:changed', on_change)
		}
	})

	// Re-check the badge after navigation (e.g. leaving the notifications page).
	$effect(() => {
		void path
		void refresh_unread()
	})

	const nav_button = 'relative flex size-12 items-center justify-center rounded-full transition'
	const active = 'bg-white text-slate-900 shadow-sm'
	const idle = 'text-slate-500 hover:bg-white/70 hover:text-slate-900'

	async function handle_sign_out() {
		await sign_out()
		window.location.href = '/login'
	}
</script>

<svelte:head><title>{title} · SNS</title></svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/60 to-slate-100">
	<nav
		aria-label="Primary"
		class="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full bg-white/80 p-1.5 shadow-lg ring-1 shadow-slate-900/5 ring-slate-200 backdrop-blur md:top-1/2 md:bottom-auto md:left-6 md:translate-x-0 md:-translate-y-1/2 md:flex-col md:py-3"
	>
		<a
			href={resolve('/')}
			aria-label="Home"
			aria-current={path === '/' ? 'page' : undefined}
			class="{nav_button} {path === '/' ? active : idle}"
		>
			<HouseIcon class="size-5" />
		</a>
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
					class="absolute top-2 right-2 flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] leading-4 font-semibold text-white"
					data-testid="unread-badge">{unread > 99 ? '99+' : unread}</span
				>
			{/if}
		</a>
		<a
			href={resolve('/u/[handle]', { handle: me_handle })}
			aria-label="My profile"
			aria-current={path.startsWith('/u/') && path.split('/')[2] === me_handle ? 'page' : undefined}
			class="{nav_button} {path.split('/')[2] === me_handle && path.startsWith('/u/')
				? active
				: idle}"
		>
			<Avatar {user} size={32} />
		</a>
		<button
			type="button"
			aria-label="Sign out"
			onclick={handle_sign_out}
			class="{nav_button} {idle} hidden md:flex"
		>
			<LogOutIcon class="size-5" />
		</button>
	</nav>

	<header class="sticky top-0 z-20 flex justify-center px-4 pt-6 pb-2">
		<div
			class="flex items-center gap-4 rounded-full bg-white/80 px-6 py-3 shadow-md ring-1 shadow-slate-900/5 ring-slate-200 backdrop-blur"
		>
			<h1 class="text-sm font-semibold text-slate-800">{title}</h1>
		</div>
	</header>

	<main class="mx-auto w-full max-w-2xl px-4 pt-4 pb-28 md:pb-16">
		{@render children()}
	</main>
</div>
