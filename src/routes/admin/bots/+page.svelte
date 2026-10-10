<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { enhance } from '$app/forms'
	import { resolve } from '$app/paths'
	import AppShell from '$lib/components/app/AppShell.svelte'
	import Avatar from '$lib/components/app/Avatar.svelte'
	import LinkPreviewCard from '$lib/components/app/LinkPreviewCard.svelte'
	import RelativeTime from '$lib/components/app/RelativeTime.svelte'
	import { parse_content } from '$lib/content'
	import { extract_first_url } from '$lib/link-preview-client'
	import { date, t, time } from '$lib/i18n'
	import CalendarIcon from '@lucide/svelte/icons/calendar'
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid'
	import ListIcon from '@lucide/svelte/icons/list'
	import LockIcon from '@lucide/svelte/icons/lock'
	import MessageSquareIcon from '@lucide/svelte/icons/message-square'
	import PauseIcon from '@lucide/svelte/icons/pause'
	import PencilIcon from '@lucide/svelte/icons/pencil'
	import PlayIcon from '@lucide/svelte/icons/play'
	import PlusIcon from '@lucide/svelte/icons/plus'
	import SearchIcon from '@lucide/svelte/icons/search'
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check'
	import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal'
	import SparklesIcon from '@lucide/svelte/icons/sparkles'
	import TrashIcon from '@lucide/svelte/icons/trash'
	import UsersIcon from '@lucide/svelte/icons/users'
	import XIcon from '@lucide/svelte/icons/x'

	let { data, form } = $props()

	// Tab Navigation: 'controls' | 'fleet' | 'posts'
	let active_tab = $state<'controls' | 'fleet' | 'posts'>('controls')

	// Fleet view mode: 'table' | 'grid'
	let fleet_view_mode = $state<'table' | 'grid'>('table')

	let is_triggering = $state(false)
	let trigger_message = $state<string | null>(null)
	let selected_bot_id = $state<string>('')
	let custom_end_date = $state<string>('')
	let search_query = $state<string>('')
	let selected_category = $state<string>('all')

	// Recent Posts filter
	let post_bot_filter = $state<string>('all')
	let post_search = $state<string>('')

	// Modals
	let show_create_modal = $state(false)
	type PersonaType = (typeof data.personas)[number]
	let editing_bot = $state<PersonaType | null>(null)

	// Create Form State
	let create_name = $state('')
	let create_username = $state('')
	let create_bio = $state('')
	let create_image = $state('')
	let create_banner_color = $state('midnight')
	let create_tone_prompt = $state('')
	let create_feeds = $state('')
	let create_hashtags = $state('')

	// Edit Form State
	let edit_name = $state('')
	let edit_username = $state('')
	let edit_bio = $state('')
	let edit_image = $state('')
	let edit_banner_color = $state('midnight')
	let edit_tone_prompt = $state('')
	let edit_feeds = $state('')
	let edit_hashtags = $state('')

	const banner_colors = [
		{ id: 'midnight', bg: 'bg-slate-900' },
		{ id: 'sunset', bg: 'bg-amber-600' },
		{ id: 'emerald', bg: 'bg-emerald-600' },
		{ id: 'violet', bg: 'bg-violet-600' },
		{ id: 'ocean', bg: 'bg-sky-600' },
		{ id: 'coral', bg: 'bg-rose-500' },
		{ id: 'amber', bg: 'bg-amber-500' },
	] as const

	function open_edit_modal(bot: PersonaType) {
		editing_bot = bot
		edit_name = bot.name
		edit_username = bot.username
		edit_bio = bot.bio || ''
		edit_image = bot.image || ''
		edit_banner_color = bot.banner_color || 'midnight'
		edit_tone_prompt = bot.tone_prompt || ''
		edit_feeds = (bot.feeds || []).join('\n')
		edit_hashtags = (bot.hashtags || []).join(', ')
	}

	function add_feed_preset(url: string, target: 'create' | 'edit') {
		if (target === 'create') {
			const existing = create_feeds
				.split('\n')
				.map((s) => s.trim())
				.filter(Boolean)
			if (!existing.includes(url)) {
				create_feeds = existing.concat(url).join('\n')
			}
		} else {
			const existing = edit_feeds
				.split('\n')
				.map((s) => s.trim())
				.filter(Boolean)
			if (!existing.includes(url)) {
				edit_feeds = existing.concat(url).join('\n')
			}
		}
	}

	let campaign_end_display = $derived(() => {
		if (!data.config?.campaign_end) return $t('admin.campaign_continuous')
		const end = new Date(data.config.campaign_end)
		const now = new Date()
		const diff_ms = end.getTime() - now.getTime()
		if (diff_ms <= 0) return $t('admin.campaign_ended')
		const diff_days = Math.floor(diff_ms / (1000 * 60 * 60 * 24))
		const diff_hours = Math.floor((diff_ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
		// $date/$time default to the active locale, so this reads correctly in ja/km too.
		return `${$date(end)} ${$time(end, { hour: '2-digit', minute: '2-digit' })} ${$t('admin.campaign_remaining', { values: { days: diff_days, hours: diff_hours } })}`
	})

	function preset_date(days: number) {
		const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
		const year = target.getFullYear()
		const month = String(target.getMonth() + 1).padStart(2, '0')
		const day = String(target.getDate()).padStart(2, '0')
		const hours = String(target.getHours()).padStart(2, '0')
		const minutes = String(target.getMinutes()).padStart(2, '0')
		custom_end_date = `${year}-${month}-${day}T${hours}:${minutes}`
	}

	let filtered_personas = $derived(() => {
		let list = data.personas
		if (selected_category !== 'all') {
			if (selected_category === 'custom') {
				list = list.filter((b) => b.is_custom)
			} else {
				list = list.filter((b) =>
					b.interests?.some((i) => i.toLowerCase().includes(selected_category)),
				)
			}
		}
		if (search_query.trim()) {
			const q = search_query.toLowerCase().trim()
			list = list.filter(
				(b) =>
					b.name.toLowerCase().includes(q) ||
					b.username.toLowerCase().includes(q) ||
					b.bio?.toLowerCase().includes(q),
			)
		}
		return list
	})

	let filtered_recent_posts = $derived(() => {
		let list = data.recent_posts
		if (post_bot_filter !== 'all') {
			list = list.filter((p) => p.user_id === post_bot_filter)
		}
		if (post_search.trim()) {
			const q = post_search.toLowerCase().trim()
			list = list.filter(
				(p) =>
					p.content.toLowerCase().includes(q) ||
					p.user_name.toLowerCase().includes(q) ||
					(p.user_username && p.user_username.toLowerCase().includes(q)),
			)
		}
		return list
	})
</script>

<svelte:head>
	<title>{$t('admin.doc_title')}</title>
</svelte:head>

<AppShell user={data.user} title={$t('admin.title')} layout="wide">
	<div class="space-y-6 pb-16">
		<!-- Header Banner -->
		<div
			class="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm md:flex-row md:items-center dark:border-slate-800 dark:bg-slate-900"
		>
			<div class="space-y-1">
				<div class="flex items-center gap-2">
					<span
						class="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700"
					>
						<ShieldCheckIcon class="size-3.5" />
						{$t('admin.admin_control')}
					</span>
					<span class="text-xs font-medium text-slate-400">•</span>
					<span class="text-xs font-medium text-slate-500">{$t('admin.tagline')}</span>
				</div>
				<h1 class="text-2xl font-black tracking-tight text-slate-900">{$t('admin.heading')}</h1>
				<p class="text-sm text-slate-500">{$t('admin.description')}</p>
			</div>

			{#if data.is_admin}
				<div class="flex flex-wrap items-center gap-2">
					<button
						type="button"
						onclick={() => (show_create_modal = true)}
						class="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800 active:scale-95 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
					>
						<PlusIcon class="size-3.5" />
						{$t('admin.create_new_bot')}
					</button>
				</div>
			{/if}
		</div>

		{#if form?.error}
			<div
				class="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800 shadow-xs"
			>
				<span>⚠️ {form.error}</span>
			</div>
		{/if}

		{#if form?.message}
			<div
				class="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 shadow-xs"
			>
				<span>✅ {form.message}</span>
			</div>
		{/if}

		{#if !data.is_admin}
			<!-- Password Unlock Box -->
			<div
				class="mx-auto max-w-md rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
			>
				<div class="text-center">
					<div
						class="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"
					>
						<LockIcon class="size-6" />
					</div>
					<h2 class="mt-3 text-base font-bold text-slate-900">{$t('admin.locked_title')}</h2>
					<p class="mt-1 text-xs text-slate-500">{$t('admin.locked_desc')}</p>
				</div>

				<form method="POST" action="?/unlock" use:enhance class="mt-5 space-y-3">
					<input
						type="password"
						name="secret"
						required
						placeholder={$t('admin.secret_placeholder')}
						class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none"
					/>
					<button
						type="submit"
						class="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-slate-800 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
					>
						{$t('admin.unlock')}
					</button>
				</form>
			</div>
		{:else}
			<!-- Primary Navigation Tabs (Eliminates infinite vertical scroll) -->
			<div class="flex items-center justify-between border-b border-slate-200/80 pb-1">
				<nav class="flex items-center gap-2" aria-label={$t('admin.nav_label')}>
					<button
						type="button"
						onclick={() => (active_tab = 'controls')}
						class="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition {active_tab ===
						'controls'
							? 'bg-slate-900 text-white shadow-xs'
							: 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100'}"
					>
						<SlidersHorizontalIcon class="size-3.5" />
						<span>{$t('admin.tab_controls')}</span>
					</button>

					<button
						type="button"
						onclick={() => (active_tab = 'fleet')}
						class="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition {active_tab ===
						'fleet'
							? 'bg-slate-900 text-white shadow-xs'
							: 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100'}"
					>
						<UsersIcon class="size-3.5" />
						<span>{$t('admin.tab_fleet')}</span>
						<span
							class="py-0.2 rounded-full px-1.5 text-[10px] {active_tab === 'fleet'
								? 'bg-white/20 text-white dark:bg-white/15'
								: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}"
						>
							{data.personas.length}
						</span>
					</button>

					<button
						type="button"
						onclick={() => (active_tab = 'posts')}
						class="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition {active_tab ===
						'posts'
							? 'bg-slate-900 text-white shadow-xs'
							: 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100'}"
					>
						<MessageSquareIcon class="size-3.5" />
						<span>{$t('admin.tab_posts')}</span>
						<span
							class="py-0.2 rounded-full px-1.5 text-[10px] {active_tab === 'posts'
								? 'bg-white/20 text-white dark:bg-white/15'
								: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}"
						>
							{data.recent_posts.length}
						</span>
					</button>
				</nav>
			</div>

			<!-- ───────────────────────────────────────────────────────────── -->
			<!-- TAB 1: OVERVIEW & MASTER CONTROLS                            -->
			<!-- ───────────────────────────────────────────────────────────── -->
			{#if active_tab === 'controls'}
				<div class="space-y-6">
					<!-- Quick Metrics Row -->
					<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
						<div class="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
							<div class="text-xs font-medium text-slate-400 uppercase">
								{$t('admin.metric_automation')}
							</div>
							<div class="mt-1 flex items-center gap-2">
								{#if data.config?.enabled}
									<span class="size-2.5 animate-pulse rounded-full bg-emerald-500"></span>
									<span class="text-sm font-bold text-emerald-700">{$t('admin.metric_active')}</span
									>
								{:else}
									<span class="size-2.5 rounded-full bg-amber-500"></span>
									<span class="text-sm font-bold text-amber-700">{$t('admin.metric_paused')}</span>
								{/if}
							</div>
							<div class="mt-1 text-[11px] text-slate-500">
								{$t('admin.interval', { values: { hours: data.config?.interval_hours ?? 3 } })}
							</div>
						</div>

						<div class="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
							<div class="text-xs font-medium text-slate-400 uppercase">
								{$t('admin.metric_schedule')}
							</div>
							<div class="mt-1 truncate text-sm font-bold text-slate-900">
								{data.config?.campaign_end
									? $t('admin.schedule_limited')
									: $t('admin.schedule_continuous')}
							</div>
							<div class="mt-1 truncate text-[11px] text-slate-500">
								{campaign_end_display()}
							</div>
						</div>

						<div class="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
							<div class="text-xs font-medium text-slate-400 uppercase">
								{$t('admin.metric_fleet_size')}
							</div>
							<div class="mt-1 text-sm font-bold text-slate-900">
								{$t('admin.accounts', { values: { count: data.personas.length } })}
							</div>
							<div class="mt-1 text-[11px] text-slate-500">
								{$t('admin.custom_configured', {
									values: { count: data.personas.filter((b) => b.is_custom).length },
								})}
							</div>
						</div>

						<div class="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-xs">
							<div class="text-xs font-medium text-slate-400 uppercase">
								{$t('admin.metric_today_posts')}
							</div>
							<div class="mt-1 text-sm font-bold text-slate-900">
								{$t('admin.seeded', {
									values: { count: data.personas.reduce((sum, b) => sum + b.daily_posts, 0) },
								})}
							</div>
							<div class="mt-1 text-[11px] text-slate-500">{$t('admin.max_limit')}</div>
						</div>
					</div>

					<!-- Master Controls Grid -->
					<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
						<!-- Control 1: Master Status Switch -->
						<div
							class="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
						>
							<div>
								<div class="flex items-center justify-between">
									<span class="text-xs font-bold tracking-wider text-slate-400 uppercase"
										>{$t('admin.pipeline_status')}</span
									>
									{#if data.config?.enabled}
										<PlayIcon class="size-4 text-emerald-600" />
									{:else}
										<PauseIcon class="size-4 text-amber-600" />
									{/if}
								</div>
								<h3 class="mt-2 text-base font-bold text-slate-900">
									{data.config?.enabled ? $t('admin.running') : $t('admin.paused')}
								</h3>
								<p class="mt-1 text-xs text-slate-500">
									{data.config?.enabled ? $t('admin.running_desc') : $t('admin.paused_desc')}
								</p>
							</div>

							<form method="POST" action="?/toggle_status" use:enhance class="mt-4">
								<input
									type="hidden"
									name="enabled"
									value={data.config?.enabled ? 'false' : 'true'}
								/>
								<button
									type="submit"
									class="w-full rounded-xl px-4 py-2.5 text-xs font-semibold transition active:scale-95 {data
										.config?.enabled
										? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
										: 'bg-emerald-600 text-white hover:bg-emerald-700'}"
								>
									{data.config?.enabled
										? $t('admin.pause_automation')
										: $t('admin.resume_automation')}
								</button>
							</form>
						</div>

						<!-- Control 2: Schedule & Campaign End Timing -->
						<div
							class="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
						>
							<div>
								<div class="flex items-center justify-between">
									<span class="text-xs font-bold tracking-wider text-slate-400 uppercase"
										>{$t('admin.schedule_control')}</span
									>
									<CalendarIcon class="size-4 text-slate-400 dark:text-slate-500" />
								</div>
								<h3 class="mt-2 truncate text-sm font-bold text-slate-900 dark:text-slate-100">
									{campaign_end_display()}
								</h3>
								<p class="mt-1 text-xs text-slate-500">{$t('admin.schedule_desc')}</p>
							</div>

							<!-- Presets & Cancel Action -->
							<div class="mt-3 space-y-2">
								<div class="flex flex-wrap gap-1.5">
									<button
										type="button"
										onclick={() => preset_date(3)}
										class="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
									>
										{$t('admin.plus_3_days')}
									</button>
									<button
										type="button"
										onclick={() => preset_date(7)}
										class="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
									>
										{$t('admin.plus_1_week')}
									</button>
									<button
										type="button"
										onclick={() => preset_date(14)}
										class="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
									>
										{$t('admin.plus_2_weeks')}
									</button>
								</div>

								<form method="POST" action="?/set_campaign" use:enhance class="flex gap-2">
									<input
										type="datetime-local"
										name="end_date"
										bind:value={custom_end_date}
										required
										class="w-full rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
									/>
									<button
										type="submit"
										class="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
									>
										{$t('admin.set')}
									</button>
								</form>

								{#if data.config?.campaign_end}
									<form method="POST" action="?/cancel_campaign" use:enhance>
										<button
											type="submit"
											class="w-full text-center text-[11px] font-semibold text-rose-600 hover:underline"
										>
											{$t('admin.clear_schedule')}
										</button>
									</form>
								{/if}
							</div>
						</div>

						<!-- Control 3: Manual News Post Trigger -->
						<div
							class="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
						>
							<div>
								<div class="flex items-center justify-between">
									<span class="text-xs font-bold tracking-wider text-slate-400 uppercase"
										>{$t('admin.immediate_trigger')}</span
									>
									<SparklesIcon class="size-4 text-indigo-500" />
								</div>
								<h3 class="mt-2 text-base font-bold text-slate-900">{$t('admin.run_cycle')}</h3>
								<p class="mt-1 text-xs text-slate-500">{$t('admin.run_cycle_desc')}</p>
							</div>

							<form
								method="POST"
								action="?/trigger_bot"
								use:enhance={() => {
									is_triggering = true
									trigger_message = null
									return async ({ update, result }) => {
										await update()
										is_triggering = false
										if (result.type === 'success' && result.data && 'message' in result.data) {
											trigger_message = result.data.message as string
										}
									}
								}}
								class="mt-3 space-y-2"
							>
								<select
									name="bot_id"
									bind:value={selected_bot_id}
									class="w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
								>
									<option value="">{$t('admin.auto_pick')}</option>
									{#each data.personas as bot (bot.id)}
										<option value={bot.id}>@{bot.username} ({bot.name})</option>
									{/each}
								</select>

								<button
									type="submit"
									disabled={is_triggering}
									class="flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
								>
									<SparklesIcon class="size-3.5 {is_triggering ? 'animate-spin' : ''}" />
									{is_triggering ? $t('admin.triggering') : $t('admin.trigger')}
								</button>
							</form>

							{#if trigger_message}
								<div
									class="mt-2 rounded-lg bg-emerald-50 p-2.5 text-[11px] font-medium text-emerald-800"
								>
									{trigger_message}
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/if}

			<!-- ───────────────────────────────────────────────────────────── -->
			<!-- TAB 2: BOT FLEET DIRECTORY                                  -->
			<!-- ───────────────────────────────────────────────────────────── -->
			{#if active_tab === 'fleet'}
				<div
					class="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900"
				>
					<!-- Directory Header with Controls -->
					<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h2 class="text-lg font-bold text-slate-900">
								{$t('admin.directory_title', {
									values: { shown: filtered_personas().length, total: data.personas.length },
								})}
							</h2>
							<p class="text-xs text-slate-500">{$t('admin.directory_desc')}</p>
						</div>

						<div class="flex flex-wrap items-center gap-2">
							<!-- Search Input -->
							<div class="relative">
								<SearchIcon
									class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
								/>
								<input
									type="text"
									bind:value={search_query}
									placeholder={$t('admin.search_bots')}
									class="rounded-xl border border-slate-200 bg-slate-50/60 py-1.5 pr-3 pl-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none"
								/>
							</div>

							<!-- View Mode Toggle (Table / Grid) -->
							<div
								class="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800"
							>
								<button
									type="button"
									onclick={() => (fleet_view_mode = 'table')}
									class="rounded-lg p-1.5 transition {fleet_view_mode === 'table'
										? 'bg-white text-slate-900 shadow-2xs'
										: 'text-slate-400 hover:text-slate-700'}"
									title={$t('admin.table_title')}
									aria-label={$t('admin.table_aria')}
								>
									<ListIcon class="size-3.5" />
								</button>
								<button
									type="button"
									onclick={() => (fleet_view_mode = 'grid')}
									class="rounded-lg p-1.5 transition {fleet_view_mode === 'grid'
										? 'bg-white text-slate-900 shadow-2xs'
										: 'text-slate-400 hover:text-slate-700'}"
									title={$t('admin.grid_title')}
									aria-label={$t('admin.grid_aria')}
								>
									<LayoutGridIcon class="size-3.5" />
								</button>
							</div>

							<button
								type="button"
								onclick={() => (show_create_modal = true)}
								class="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
							>
								<PlusIcon class="size-3.5" />
								{$t('admin.new_bot')}
							</button>
						</div>
					</div>

					<!-- Category Filters -->
					<div class="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3 text-xs">
						{#each [{ id: 'all', label_key: 'admin.filter_all' }, { id: 'tech', label_key: 'admin.filter_tech' }, { id: 'anime', label_key: 'admin.filter_anime' }, { id: 'movie', label_key: 'admin.filter_movie' }, { id: 'economic', label_key: 'admin.filter_economic' }, { id: 'cafe', label_key: 'admin.filter_cafe' }, { id: 'custom', label_key: 'admin.filter_custom' }] as tab (tab.id)}
							<button
								type="button"
								onclick={() => (selected_category = tab.id)}
								class="rounded-lg px-2.5 py-1 text-xs font-medium transition {selected_category ===
								tab.id
									? 'bg-slate-900 text-white'
									: 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}"
							>
								{$t(tab.label_key)}
							</button>
						{/each}
					</div>

					{#if filtered_personas().length === 0}
						<div class="py-12 text-center text-xs text-slate-400">
							{$t('admin.no_bots')}
						</div>
					{:else if fleet_view_mode === 'table'}
						<!-- High-Density Compact Table View -->
						<div
							class="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800"
						>
							<table class="w-full text-left text-xs">
								<thead class="bg-slate-50 font-bold text-slate-500 uppercase">
									<tr class="border-b border-slate-200/80">
										<th class="py-3 pr-3 pl-4">{$t('admin.col_persona')}</th>
										<th class="hidden px-3 py-3 md:table-cell">{$t('admin.col_topics')}</th>
										<th class="hidden px-3 py-3 sm:table-cell">{$t('admin.col_feeds')}</th>
										<th class="px-3 py-3">{$t('admin.col_today_total')}</th>
										<th class="py-3 pr-4 pl-3 text-right">{$t('admin.col_actions')}</th>
									</tr>
								</thead>
								<tbody
									class="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900"
								>
									{#each filtered_personas() as bot (bot.id)}
										<tr class="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/60">
											<!-- Bot Profile -->
											<td class="py-3 pr-3 pl-4">
												<div class="flex items-center gap-2.5">
													<Avatar
														user={{
															name: bot.name,
															image: bot.image,
														}}
														size={34}
													/>
													<div class="min-w-0">
														<div class="flex items-center gap-1.5">
															<span class="truncate font-bold text-slate-900 dark:text-slate-100"
																>{bot.name}</span
															>
															{#if bot.is_custom}
																<span
																	class="py-0.2 rounded bg-indigo-50 px-1 text-[9px] font-semibold text-indigo-700"
																	>{$t('admin.custom_badge')}</span
																>
															{/if}
														</div>
														<a
															href={resolve('/u/[handle]', { handle: bot.username })}
															target="_blank"
															class="inline-flex items-center gap-0.5 truncate text-[11px] text-slate-500 hover:text-indigo-600"
														>
															@{bot.username}
															<ExternalLinkIcon class="size-2.5 opacity-60" />
														</a>
													</div>
												</div>
											</td>

											<!-- Topics -->
											<td class="hidden px-3 py-3 md:table-cell">
												<div class="flex max-w-[220px] flex-wrap gap-1">
													{#each (bot.hashtags || []).slice(0, 2) as tag (tag)}
														<span
															class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
														>
															{tag}
														</span>
													{/each}
												</div>
											</td>

											<!-- Feeds -->
											<td class="hidden px-3 py-3 sm:table-cell">
												<span
													class="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
												>
													{$t('admin.feeds_count', { values: { count: (bot.feeds || []).length } })}
												</span>
											</td>

											<!-- Posts count -->
											<td class="px-3 py-3">
												<span class="font-bold text-slate-800">{bot.daily_posts}/3</span>
												<span class="text-[10px] text-slate-400"
													>{$t('admin.total_count', { values: { count: bot.total_posts } })}</span
												>
											</td>

											<!-- Actions -->
											<td class="py-3 pr-4 pl-3 text-right">
												<div class="flex items-center justify-end gap-1.5">
													<form method="POST" action="?/trigger_bot" use:enhance>
														<input type="hidden" name="bot_id" value={bot.id} />
														<button
															type="submit"
															title={$t('admin.trigger_now')}
															class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs hover:bg-slate-100"
														>
															{$t('admin.post_now')}
														</button>
													</form>

													<button
														type="button"
														onclick={() => open_edit_modal(bot)}
														title={$t('admin.edit_prompt')}
														class="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 shadow-2xs hover:bg-slate-50"
													>
														<PencilIcon class="size-3.5" />
													</button>

													{#if bot.is_custom}
														<form method="POST" action="?/delete_bot" use:enhance>
															<input type="hidden" name="bot_id" value={bot.id} />
															<button
																type="submit"
																onclick={(e) => {
																	if (
																		!confirm(
																			$t('admin.delete_bot_confirm', {
																				values: { handle: bot.username },
																			}),
																		)
																	) {
																		e.preventDefault()
																	}
																}}
																class="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950 dark:hover:text-rose-400"
															>
																<TrashIcon class="size-3.5" />
															</button>
														</form>
													{/if}
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{:else}
						<!-- Grid View Mode -->
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{#each filtered_personas() as bot (bot.id)}
								<div
									class="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition hover:border-slate-300 hover:shadow-xs dark:border-slate-800 dark:bg-slate-800/50"
								>
									<div>
										<div class="flex items-start justify-between gap-3">
											<div class="flex items-start gap-3">
												<Avatar
													user={{
														name: bot.name,
														image: bot.image,
													}}
													size={42}
												/>
												<div class="min-w-0">
													<div class="flex items-center gap-1.5">
														<span
															class="truncate text-xs font-bold text-slate-900 dark:text-slate-100"
															>{bot.name}</span
														>
														{#if bot.is_custom}
															<span
																class="py-0.2 rounded bg-indigo-50 px-1.5 text-[10px] font-semibold text-indigo-700"
																>{$t('admin.custom_badge')}</span
															>
														{/if}
													</div>
													<a
														href={resolve('/u/[handle]', { handle: bot.username })}
														target="_blank"
														class="inline-flex items-center gap-0.5 truncate text-[11px] text-slate-500 hover:text-indigo-600"
													>
														@{bot.username}
														<ExternalLinkIcon class="size-2.5 opacity-60" />
													</a>
												</div>
											</div>

											<button
												type="button"
												onclick={() => open_edit_modal(bot)}
												title={$t('admin.edit_bot')}
												class="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 shadow-2xs hover:bg-slate-50"
											>
												<PencilIcon class="size-3.5" />
											</button>
										</div>

										<p class="mt-2.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
											{bot.bio}
										</p>

										<div class="mt-2.5 flex flex-wrap gap-1">
											{#each (bot.feeds || []).slice(0, 2) as f (f)}
												<span
													class="max-w-[180px] truncate rounded border border-slate-200/60 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800"
												>
													{f.replace(/https?:\/\/(www\.)?/, '').split('/')[0]}
												</span>
											{/each}
											{#if (bot.feeds || []).length > 2}
												<span class="text-[10px] text-slate-400"
													>{$t('admin.more_feeds', {
														values: { count: bot.feeds.length - 2 },
													})}</span
												>
											{/if}
										</div>
									</div>

									<div
										class="mt-4 flex items-center justify-between border-t border-slate-200/60 pt-2.5 dark:border-slate-800"
									>
										<div class="text-[10px] text-slate-500">
											{$t('admin.today_total', {
												values: { today: bot.daily_posts, total: bot.total_posts },
											})}
										</div>

										<div class="flex items-center gap-1.5">
											<form method="POST" action="?/trigger_bot" use:enhance>
												<input type="hidden" name="bot_id" value={bot.id} />
												<button
													type="submit"
													title={$t('admin.post_immediately')}
													class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs hover:bg-slate-100"
												>
													{$t('admin.post_now')}
												</button>
											</form>

											{#if bot.is_custom}
												<form method="POST" action="?/delete_bot" use:enhance>
													<input type="hidden" name="bot_id" value={bot.id} />
													<button
														type="submit"
														onclick={(e) => {
															if (
																!confirm(
																	$t('admin.delete_bot_confirm', {
																		values: { handle: bot.username },
																	}),
																)
															) {
																e.preventDefault()
															}
														}}
														class="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950 dark:hover:text-rose-400"
													>
														<TrashIcon class="size-3.5" />
													</button>
												</form>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- ───────────────────────────────────────────────────────────── -->
			<!-- TAB 3: RECENT POSTS & ACTIVITY                              -->
			<!-- ───────────────────────────────────────────────────────────── -->
			{#if active_tab === 'posts'}
				<div
					class="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900"
				>
					<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h2 class="text-lg font-bold text-slate-900">
								{$t('admin.recent_title', {
									values: {
										shown: filtered_recent_posts().length,
										total: data.recent_posts.length,
									},
								})}
							</h2>
							<p class="text-xs text-slate-500">{$t('admin.recent_desc')}</p>
						</div>

						<div class="flex flex-wrap items-center gap-2">
							<!-- Search Input -->
							<div class="relative">
								<SearchIcon
									class="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
								/>
								<input
									type="text"
									bind:value={post_search}
									placeholder={$t('admin.search_posts')}
									class="rounded-xl border border-slate-200 bg-slate-50/60 py-1.5 pr-3 pl-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-900 focus:bg-white focus:outline-none"
								/>
							</div>

							<!-- Filter by bot -->
							<select
								bind:value={post_bot_filter}
								class="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
							>
								<option value="all">{$t('admin.filter_all')}</option>
								{#each data.personas as bot (bot.id)}
									<option value={bot.id}>@{bot.username}</option>
								{/each}
							</select>
						</div>
					</div>

					{#if filtered_recent_posts().length === 0}
						<div class="py-12 text-center text-xs text-slate-400">{$t('admin.no_posts')}</div>
					{:else}
						<div class="divide-y divide-slate-100 dark:divide-slate-800">
							{#each filtered_recent_posts() as item (item.id)}
								{@const first_link = extract_first_url(item.content)}
								<div class="flex items-start justify-between gap-4 py-4">
									<div class="flex items-start gap-3">
										<Avatar
											user={{
												name: item.user_name,
												image: item.user_image,
											}}
											size={40}
										/>
										<div class="space-y-1">
											<div class="flex items-center gap-1.5 text-xs">
												<span class="font-bold text-slate-900 dark:text-slate-100"
													>{item.user_name}</span
												>
												<span class="text-slate-400">@{item.user_username}</span>
												<span class="text-slate-400">•</span>
												<span class="text-slate-400"><RelativeTime iso={item.created_at} /></span>
											</div>

											{#if parse_content(item.content, { exclude_url: first_link }).length > 0}
												<div
													class="text-xs leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-300"
												>
													{#each parse_content( item.content, { exclude_url: first_link } ) as segment, i (i)}
														{#if segment.type === 'tag'}
															<a
																href="{resolve('/explore')}?q={encodeURIComponent(segment.text)}"
																class="font-medium text-system-blue hover:underline"
																>{segment.text}</a
															>
														{:else if segment.type === 'link'}
															<a
																href={segment.href}
																target="_blank"
																rel="noopener noreferrer"
																class="font-medium text-system-blue hover:underline"
																>{segment.text}</a
															>
														{:else}
															{segment.text}
														{/if}
													{/each}
												</div>
											{/if}

											<!-- Render Link Preview Card directly in admin post feed -->
											{#if first_link}
												<div class="max-w-md pt-1">
													<LinkPreviewCard url={first_link} compact={true} />
												</div>
											{/if}
										</div>
									</div>

									<div class="flex shrink-0 items-center gap-2">
										<a
											href={resolve('/posts/[id]', { id: item.id })}
											target="_blank"
											class="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
										>
											{$t('pin_card.view').replace(/\s*→$/, '')}
										</a>

										<form method="POST" action="?/delete_post" use:enhance>
											<input type="hidden" name="post_id" value={item.id} />
											<button
												type="submit"
												aria-label={$t('admin.delete_bot_post')}
												class="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
											>
												<TrashIcon class="size-3.5" />
											</button>
										</form>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</div>

	<!-- ─── CREATE BOT MODAL ─── -->
	{#if show_create_modal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
		>
			<div
				class="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900"
			>
				<div
					class="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800"
				>
					<div>
						<h3 class="text-base font-bold text-slate-900">{$t('admin.create_title')}</h3>
						<p class="text-xs text-slate-500">{$t('admin.create_desc')}</p>
					</div>
					<button
						type="button"
						onclick={() => (show_create_modal = false)}
						class="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
					>
						<XIcon class="size-4" />
					</button>
				</div>

				<form
					method="POST"
					action="?/create_bot"
					use:enhance={() => {
						return async ({ update, result }) => {
							await update()
							if (result.type === 'success') {
								show_create_modal = false
							}
						}
					}}
					class="space-y-4"
				>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<label for="create_name" class="block text-xs font-bold text-slate-700"
								>{$t('edit_profile.display_name')}</label
							>
							<input
								id="create_name"
								type="text"
								name="name"
								bind:value={create_name}
								required
								placeholder={$t('admin.name_placeholder')}
								class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
							/>
						</div>
						<div>
							<label for="create_username" class="block text-xs font-bold text-slate-700"
								>{$t('edit_profile.username')}</label
							>
							<input
								id="create_username"
								type="text"
								name="username"
								bind:value={create_username}
								required
								placeholder={$t('admin.username_placeholder')}
								class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
							/>
						</div>
					</div>

					<div>
						<label for="create_bio" class="block text-xs font-bold text-slate-700"
							>{$t('admin.bio_label')}</label
						>
						<textarea
							id="create_bio"
							name="bio"
							bind:value={create_bio}
							rows={2}
							placeholder={$t('admin.bio_placeholder')}
							class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
						></textarea>
					</div>

					<div>
						<label for="create_image" class="block text-xs font-bold text-slate-700"
							>{$t('admin.image_label')}</label
						>
						<input
							id="create_image"
							type="url"
							name="image"
							bind:value={create_image}
							placeholder="https://api.dicebear.com/7.x/notionists/svg?seed=maya"
							class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
						/>
					</div>

					<div>
						<span class="block text-xs font-bold text-slate-700">{$t('admin.banner_label')}</span>
						<div class="mt-1.5 flex flex-wrap gap-2">
							{#each banner_colors as color (color.id)}
								<label class="flex cursor-pointer items-center gap-1.5 text-xs">
									<input
										type="radio"
										name="banner_color"
										value={color.id}
										bind:group={create_banner_color}
										class="sr-only"
									/>
									<span
										class="size-5 rounded-full {color.bg} border-2 {create_banner_color === color.id
											? 'border-indigo-600 ring-2 ring-indigo-200'
											: 'border-white'}"
									></span>
									<span class="text-[11px] text-slate-600">{$t(`admin.color_${color.id}`)}</span>
								</label>
							{/each}
						</div>
					</div>

					<div>
						<label for="create_tone_prompt" class="block text-xs font-bold text-slate-700"
							>{$t('admin.tone_label')}</label
						>
						<textarea
							id="create_tone_prompt"
							name="tone_prompt"
							bind:value={create_tone_prompt}
							rows={3}
							required
							placeholder={$t('admin.tone_placeholder')}
							class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
						></textarea>
					</div>

					<div>
						<label for="create_feeds" class="block text-xs font-bold text-slate-700"
							>{$t('admin.feeds_label')}</label
						>
						<textarea
							id="create_feeds"
							name="feeds"
							bind:value={create_feeds}
							rows={3}
							required
							placeholder="https://dev.to/feed"
							class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
						></textarea>

						<div class="mt-2">
							<span class="text-[11px] font-semibold text-slate-500"
								>{$t('admin.presets_create')}</span
							>
							<div class="mt-1 flex flex-wrap gap-1">
								{#each data.trusted_presets as preset (preset.url)}
									<button
										type="button"
										onclick={() => add_feed_preset(preset.url, 'create')}
										class="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
									>
										+ {preset.name}
									</button>
								{/each}
							</div>
						</div>
					</div>

					<div>
						<label for="create_hashtags" class="block text-xs font-bold text-slate-700"
							>{$t('admin.hashtags_label')}</label
						>
						<input
							id="create_hashtags"
							type="text"
							name="hashtags"
							bind:value={create_hashtags}
							placeholder={$t('admin.hashtags_placeholder')}
							class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
						/>
					</div>

					<div
						class="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800"
					>
						<button
							type="button"
							onclick={() => (show_create_modal = false)}
							class="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
						>
							{$t('common.cancel')}
						</button>
						<button
							type="submit"
							class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
						>
							{$t('admin.create_submit')}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- ─── EDIT BOT MODAL ─── -->
	{#if editing_bot}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
		>
			<div
				class="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900"
			>
				<div
					class="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800"
				>
					<div>
						<h3 class="text-base font-bold text-slate-900">{$t('admin.edit_title')}</h3>
						<p class="text-xs text-slate-500">{$t('admin.edit_desc')}</p>
					</div>
					<button
						type="button"
						onclick={() => (editing_bot = null)}
						class="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
					>
						<XIcon class="size-4" />
					</button>
				</div>

				<form
					method="POST"
					action="?/update_bot"
					use:enhance={() => {
						return async ({ update, result }) => {
							await update()
							if (result.type === 'success') {
								editing_bot = null
							}
						}
					}}
					class="space-y-4"
				>
					<input type="hidden" name="bot_id" value={editing_bot.id} />

					<div class="grid grid-cols-2 gap-3">
						<div>
							<label for="edit_name" class="block text-xs font-bold text-slate-700"
								>{$t('edit_profile.display_name')}</label
							>
							<input
								id="edit_name"
								type="text"
								name="name"
								bind:value={edit_name}
								required
								class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
							/>
						</div>
						<div>
							<label for="edit_username" class="block text-xs font-bold text-slate-700"
								>{$t('edit_profile.username')}</label
							>
							<input
								id="edit_username"
								type="text"
								name="username"
								bind:value={edit_username}
								required
								class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
							/>
						</div>
					</div>

					<div>
						<label for="edit_bio" class="block text-xs font-bold text-slate-700"
							>{$t('edit_profile.bio')}</label
						>
						<textarea
							id="edit_bio"
							name="bio"
							bind:value={edit_bio}
							rows={2}
							class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
						></textarea>
					</div>

					<div>
						<label for="edit_image" class="block text-xs font-bold text-slate-700"
							>{$t('admin.image_label')}</label
						>
						<input
							id="edit_image"
							type="url"
							name="image"
							bind:value={edit_image}
							class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
						/>
					</div>

					<div>
						<span class="block text-xs font-bold text-slate-700">{$t('admin.banner_label')}</span>
						<div class="mt-1.5 flex flex-wrap gap-2">
							{#each banner_colors as color (color.id)}
								<label class="flex cursor-pointer items-center gap-1.5 text-xs">
									<input
										type="radio"
										name="banner_color"
										value={color.id}
										bind:group={edit_banner_color}
										class="sr-only"
									/>
									<span
										class="size-5 rounded-full {color.bg} border-2 {edit_banner_color === color.id
											? 'border-indigo-600 ring-2 ring-indigo-200'
											: 'border-white'}"
									></span>
									<span class="text-[11px] text-slate-600">{$t(`admin.color_${color.id}`)}</span>
								</label>
							{/each}
						</div>
					</div>

					<div>
						<label for="edit_tone_prompt" class="block text-xs font-bold text-slate-700"
							>{$t('admin.tone_label')}</label
						>
						<textarea
							id="edit_tone_prompt"
							name="tone_prompt"
							bind:value={edit_tone_prompt}
							rows={3}
							class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
						></textarea>
					</div>

					<div>
						<label for="edit_feeds" class="block text-xs font-bold text-slate-700"
							>{$t('admin.feeds_label')}</label
						>
						<textarea
							id="edit_feeds"
							name="feeds"
							bind:value={edit_feeds}
							rows={3}
							class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
						></textarea>

						<div class="mt-2">
							<span class="text-[11px] font-semibold text-slate-500"
								>{$t('admin.presets_edit')}</span
							>
							<div class="mt-1 flex flex-wrap gap-1">
								{#each data.trusted_presets as preset (preset.url)}
									<button
										type="button"
										onclick={() => add_feed_preset(preset.url, 'edit')}
										class="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
									>
										+ {preset.name}
									</button>
								{/each}
							</div>
						</div>
					</div>

					<div>
						<label for="edit_hashtags" class="block text-xs font-bold text-slate-700"
							>{$t('admin.hashtags_label')}</label
						>
						<input
							id="edit_hashtags"
							type="text"
							name="hashtags"
							bind:value={edit_hashtags}
							class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
						/>
					</div>

					<div
						class="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800"
					>
						<button
							type="button"
							onclick={() => (editing_bot = null)}
							class="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
						>
							{$t('common.cancel')}
						</button>
						<button
							type="submit"
							class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
						>
							{$t('admin.save_submit')}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</AppShell>
