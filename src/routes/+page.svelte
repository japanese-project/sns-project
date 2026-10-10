<script lang="ts">
	import GlobeIcon from '@lucide/svelte/icons/globe'
	import UsersIcon from '@lucide/svelte/icons/users'
	import AppShell from '$lib/components/app/AppShell.svelte'
	import HomeSidebar from '$lib/components/app/HomeSidebar.svelte'
	import PostList from '$lib/components/app/PostList.svelte'
	import { t } from '$lib/i18n'

	let { data } = $props()

	let tab_override = $state<'following' | 'global' | null>(null)
	let active_tab = $derived(tab_override ?? 'global')

	function set_tab(tab: 'following' | 'global') {
		tab_override = tab
	}
</script>

<AppShell user={data.user} title={$t('nav.home')}>
	{#snippet header_content()}
		<!-- Integrated Global / Following Switcher in Top Pill -->
		<div
			class="inline-flex items-center rounded-full bg-slate-100/90 p-0.5 text-xs font-semibold shadow-inner dark:bg-slate-800/90"
			role="tablist"
			aria-label={$t('home.feed_selection')}
		>
			<button
				type="button"
				role="tab"
				aria-selected={active_tab === 'global'}
				onclick={() => set_tab('global')}
				class="flex items-center gap-1.5 rounded-full px-3 py-1 transition-all duration-200 active:scale-95 {active_tab ===
				'global'
					? 'bg-black font-bold text-white shadow-xs'
					: 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/50 dark:hover:text-slate-100'}"
			>
				<GlobeIcon class="size-3.5" />
				<span>{$t('home.global')}</span>
			</button>

			<button
				type="button"
				role="tab"
				aria-selected={active_tab === 'following'}
				onclick={() => set_tab('following')}
				class="flex items-center gap-1.5 rounded-full px-3 py-1 transition-all duration-200 active:scale-95 {active_tab ===
				'following'
					? 'bg-black font-bold text-white shadow-xs'
					: 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/50 dark:hover:text-slate-100'}"
			>
				<UsersIcon class="size-3.5" />
				<span>{$t('home.following')}</span>
			</button>
		</div>
	{/snippet}

	{#snippet right_sidebar()}
		<HomeSidebar
			suggested_users={data.suggested_users ?? []}
			trending_topics={data.trending_topics ?? []}
		/>
	{/snippet}

	<!-- Primary Feed (Global) -->
	<div class={active_tab === 'global' ? 'block' : 'hidden'}>
		<PostList
			endpoint="/api/posts?feed=global"
			accepts_new_posts
			empty_message={$t('home.empty_global')}
		/>
	</div>

	<!-- Following Feed -->
	<div class={active_tab === 'following' ? 'block' : 'hidden'}>
		<PostList
			endpoint="/api/posts?feed=following"
			accepts_new_posts
			empty_message={$t('home.empty_following')}
		/>
	</div>
</AppShell>
