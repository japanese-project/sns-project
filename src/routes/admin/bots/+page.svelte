<script lang="ts">
	import { enhance } from '$app/forms'
	import { resolve } from '$app/paths'
	import AppShell from '$lib/components/app/AppShell.svelte'
	import Avatar from '$lib/components/app/Avatar.svelte'
	import BotIcon from '@lucide/svelte/icons/bot'
	import CalendarIcon from '@lucide/svelte/icons/calendar'
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link'
	import LockIcon from '@lucide/svelte/icons/lock'
	import PauseIcon from '@lucide/svelte/icons/pause'
	import PlayIcon from '@lucide/svelte/icons/play'
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check'
	import SparklesIcon from '@lucide/svelte/icons/sparkles'
	import TrashIcon from '@lucide/svelte/icons/trash'

	let { data, form } = $props()

	let is_triggering = $state(false)
	let trigger_message = $state<string | null>(null)
	let selected_bot_id = $state<string>('')
	let custom_end_date = $state<string>('')

	let campaign_end_display = $derived(() => {
		if (!data.config?.campaign_end) return 'Continuous (No End Date)'
		const end = new Date(data.config.campaign_end)
		const now = new Date()
		const diff_ms = end.getTime() - now.getTime()
		if (diff_ms <= 0) return 'Ended (Campaign Expired)'
		const diff_days = Math.floor(diff_ms / (1000 * 60 * 60 * 24))
		const diff_hours = Math.floor((diff_ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
		return `${end.toLocaleDateString()} ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${diff_days}d ${diff_hours}h remaining)`
	})

	function preset_date(days: number) {
		const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
		// Format to YYYY-MM-DDTHH:mm for datetime-local input
		const local = new Date(target.getTime() - target.getTimezoneOffset() * 60000)
		custom_end_date = local.toISOString().slice(0, 16)
	}
</script>

<AppShell user={data.user} title="Bot Administration">
	<div class="space-y-6 pb-20">
		<!-- Header -->
		<div
			class="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between"
		>
			<div class="flex items-center gap-3.5">
				<div
					class="flex size-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs"
				>
					<BotIcon class="size-6 text-emerald-400" />
				</div>
				<div>
					<div class="flex items-center gap-2">
						<h1 class="text-lg font-bold text-slate-900">Bot Fleet Operations</h1>
						{#if data.is_admin}
							<span
								class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700"
							>
								<ShieldCheckIcon class="size-3.5" />
								Admin Verified
							</span>
						{/if}
					</div>
					<p class="text-xs text-slate-500">
						Manage automated 20-persona content feeding and campaign timing.
					</p>
				</div>
			</div>

			{#if data.is_admin}
				<div class="flex items-center gap-2">
					<span
						class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold {data
							.config?.enabled
							? 'bg-emerald-500/10 text-emerald-700'
							: 'bg-amber-500/10 text-amber-700'}"
					>
						<span
							class="size-2 rounded-full {data.config?.enabled
								? 'animate-pulse bg-emerald-500'
								: 'bg-amber-500'}"
						></span>
						{data.config?.enabled ? 'Automation Active' : 'Automation Paused'}
					</span>
				</div>
			{/if}
		</div>

		{#if !data.is_admin}
			<!-- Admin Unlock Form -->
			<div
				class="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs"
			>
				<div
					class="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-700"
				>
					<LockIcon class="size-6" />
				</div>
				<h2 class="text-base font-bold text-slate-900">Admin Authorization Required</h2>
				<p class="mt-1 text-xs text-slate-500">
					Enter your <code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-800"
						>BOT_CRON_SECRET</code
					> or admin key to unlock bot operations.
				</p>

				{#if form?.error}
					<div
						class="mt-4 rounded-lg bg-rose-50 p-2.5 text-xs font-medium text-rose-700"
						role="alert"
					>
						{form.error}
					</div>
				{/if}

				<form method="POST" action="?/unlock" use:enhance class="mt-5 space-y-3">
					<input
						type="password"
						name="secret"
						required
						placeholder="Paste your secret key"
						class="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none"
					/>
					<button
						type="submit"
						class="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-slate-800 active:scale-[0.98]"
					>
						Unlock Access
					</button>
				</form>
			</div>
		{:else}
			<!-- Master Controls Grid -->
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<!-- Control 1: Master Status Switch -->
				<div
					class="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs"
				>
					<div>
						<div class="flex items-center justify-between">
							<span class="text-xs font-bold tracking-wider text-slate-400 uppercase">Status</span>
							{#if data.config?.enabled}
								<PlayIcon class="size-4 text-emerald-600" />
							{:else}
								<PauseIcon class="size-4 text-amber-600" />
							{/if}
						</div>
						<h3 class="mt-2 text-base font-bold text-slate-900">
							{data.config?.enabled ? 'Running Normally' : 'Currently Paused'}
						</h3>
						<p class="mt-1 text-xs text-slate-500">
							{data.config?.enabled
								? 'The bot cron pipeline will execute on schedule every 3 hours.'
								: 'Scheduled runs will be skipped until resumed.'}
						</p>
					</div>

					<form method="POST" action="?/toggle_status" use:enhance class="mt-4">
						<input type="hidden" name="enabled" value={data.config?.enabled ? 'false' : 'true'} />
						<button
							type="submit"
							class="w-full rounded-xl px-4 py-2 text-xs font-semibold transition active:scale-95 {data
								.config?.enabled
								? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
								: 'bg-emerald-600 text-white hover:bg-emerald-700'}"
						>
							{data.config?.enabled ? 'Pause Automated Posting' : 'Resume Automated Posting'}
						</button>
					</form>
				</div>

				<!-- Control 2: Campaign Timing -->
				<div
					class="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs"
				>
					<div>
						<div class="flex items-center justify-between">
							<span class="text-xs font-bold tracking-wider text-slate-400 uppercase"
								>Campaign Limit</span
							>
							<CalendarIcon class="size-4 text-slate-400" />
						</div>
						<h3 class="mt-2 text-sm font-bold text-slate-900">
							{campaign_end_display()}
						</h3>
						<p class="mt-1 text-xs text-slate-500">
							Bots automatically stop posting when the target time is reached.
						</p>
					</div>

					<!-- Presets -->
					<div class="mt-3 flex flex-wrap gap-1.5">
						<button
							type="button"
							onclick={() => preset_date(7)}
							class="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
						>
							+1 Week
						</button>
						<button
							type="button"
							onclick={() => preset_date(14)}
							class="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
						>
							+2 Weeks
						</button>
						<button
							type="button"
							onclick={() => (custom_end_date = '')}
							class="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
						>
							Clear (Indefinite)
						</button>
					</div>

					<form method="POST" action="?/set_campaign" use:enhance class="mt-3 space-y-2">
						<input
							type="datetime-local"
							name="campaign_end"
							bind:value={custom_end_date}
							class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none"
						/>
						<button
							type="submit"
							class="w-full rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-slate-800 active:scale-95"
						>
							Update Campaign Limit
						</button>
					</form>
				</div>

				<!-- Control 3: Trigger Instant Post -->
				<div
					class="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs"
				>
					<div>
						<div class="flex items-center justify-between">
							<span class="text-xs font-bold tracking-wider text-slate-400 uppercase"
								>Manual Trigger</span
							>
							<SparklesIcon class="size-4 text-indigo-500" />
						</div>
						<h3 class="mt-2 text-base font-bold text-slate-900">Post Right Now</h3>
						<p class="mt-1 text-xs text-slate-500">
							Fetch live RSS, generate natural AI commentary, and publish instantly.
						</p>
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
								if (result.type === 'success' && result.data) {
									const data_res = result.data as {
										result?: {
											posted?: { botHandle: string; title: string }
											message?: string
										}
									}
									const res = data_res.result
									if (res?.posted) {
										trigger_message = `✅ @${res.posted.botHandle} published: "${res.posted.title.slice(0, 40)}..."`
									} else {
										trigger_message = res?.message ?? 'Executed cycle.'
									}
								}
							}
						}}
						class="mt-4 space-y-2"
					>
						<select
							name="bot_id"
							bind:value={selected_bot_id}
							class="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-none"
						>
							<option value="">🎲 Auto-pick least active bot</option>
							{#each data.personas as bot (bot.id)}
								<option value={bot.id}>@{bot.username} ({bot.name})</option>
							{/each}
						</select>

						<button
							type="submit"
							disabled={is_triggering}
							class="flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
						>
							<SparklesIcon class="size-3.5 {is_triggering ? 'animate-spin' : ''}" />
							{is_triggering ? 'Generating & Publishing...' : 'Trigger Bot Post ⚡'}
						</button>
					</form>

					{#if trigger_message}
						<div class="mt-2 rounded-lg bg-emerald-50 p-2 text-[11px] font-medium text-emerald-800">
							{trigger_message}
						</div>
					{/if}
				</div>
			</div>

			<!-- Bot Personas Pool -->
			<div class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
				<div class="mb-4 flex items-center justify-between">
					<div>
						<h2 class="text-sm font-bold text-slate-900">Bot Personas Pool (20 Accounts)</h2>
						<p class="text-xs text-slate-500">
							Each account handles specialized topics and posts up to 3 times per day.
						</p>
					</div>
					<span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
						{data.personas.reduce((sum, b) => sum + b.daily_posts, 0)} posts today
					</span>
				</div>

				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{#each data.personas as bot (bot.id)}
						<div
							class="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs transition hover:border-slate-300"
						>
							<div class="flex items-start gap-2.5">
								<Avatar
									user={{
										name: bot.name,
										image: bot.image,
									}}
									size={34}
								/>
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-1 truncate font-semibold text-slate-900">
										{bot.name}
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

							<p class="mt-2 line-clamp-2 text-[11px] text-slate-600">
								{bot.bio}
							</p>

							<div class="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-2">
								<div class="text-[10px] text-slate-500">
									<span class="font-bold text-slate-800">{bot.daily_posts}/3</span> today • {bot.total_posts}
									total
								</div>

								<form method="POST" action="?/trigger_bot" use:enhance>
									<input type="hidden" name="bot_id" value={bot.id} />
									<button
										type="submit"
										title="Post as @{bot.username}"
										class="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-xs hover:bg-slate-100"
									>
										Post Now
									</button>
								</form>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Recent Bot Posts Stream -->
			<div class="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
				<div class="mb-4 flex items-center justify-between">
					<div>
						<h2 class="text-sm font-bold text-slate-900">Recent Bot Content Feed</h2>
						<p class="text-xs text-slate-500">Latest posts generated and published by bots.</p>
					</div>
					<span class="text-xs text-slate-400">Showing last 15 posts</span>
				</div>

				{#if data.recent_posts.length === 0}
					<div class="py-8 text-center text-xs text-slate-400">
						No bot posts recorded in the database yet. Click "Trigger Bot Post ⚡" above to create
						the first one!
					</div>
				{:else}
					<div class="divide-y divide-slate-100">
						{#each data.recent_posts as item (item.id)}
							<div class="flex items-start justify-between gap-4 py-3">
								<div class="flex min-w-0 items-start gap-3">
									<Avatar
										user={{
											name: item.user_name,
											image: item.user_image,
										}}
										size={32}
									/>
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											<span class="text-xs font-semibold text-slate-900">{item.user_name}</span>
											<span class="text-xs text-slate-400">@{item.user_username}</span>
											<span class="text-[10px] text-slate-400">
												{new Date(item.created_at).toLocaleTimeString([], {
													hour: '2-digit',
													minute: '2-digit',
												})}
											</span>
										</div>
										<p class="mt-1 line-clamp-2 text-xs text-slate-700">
											{item.content}
										</p>
									</div>
								</div>

								<div class="flex shrink-0 items-center gap-2">
									<a
										href={resolve('/posts/[id]', { id: item.id })}
										target="_blank"
										class="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
									>
										View
									</a>

									<form method="POST" action="?/delete_post" use:enhance>
										<input type="hidden" name="post_id" value={item.id} />
										<button
											type="submit"
											aria-label="Delete bot post"
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
	</div>
</AppShell>
