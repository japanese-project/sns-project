<script lang="ts">
	import { setMode, resetMode, userPrefersMode } from 'mode-watcher'
	import SunIcon from '@lucide/svelte/icons/sun'
	import MoonIcon from '@lucide/svelte/icons/moon'
	import MonitorIcon from '@lucide/svelte/icons/monitor'

	const modes = ['light', 'dark', 'system'] as const
	let current = $derived(userPrefersMode.current)

	function cycle() {
		const next = modes[(modes.indexOf(current) + 1) % modes.length]
		if (next === 'system') {
			resetMode()
		} else {
			setMode(next)
		}
	}
</script>

<button
	type="button"
	onclick={cycle}
	title="Theme: {current}"
	aria-label="Theme: {current}. Activate to change."
	class="flex size-11 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:outline-none active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:focus-visible:ring-slate-100"
>
	{#if current === 'light'}
		<SunIcon class="size-5" />
	{:else if current === 'dark'}
		<MoonIcon class="size-5" />
	{:else}
		<MonitorIcon class="size-5" />
	{/if}
</button>
