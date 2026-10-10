<script lang="ts">
	// Locale-aware timestamp. Bucketing lives in $lib/time; the wording comes from the locale
	// dictionaries, and the store subscriptions are what re-render on a language change.
	import { date, t } from '$lib/i18n'
	import { relative_time_parts } from '$lib/time'

	let { iso, now }: { iso: string; now?: number } = $props()

	let parts = $derived(relative_time_parts(iso, now))
</script>

{#if parts}
	{$t(parts.key, { values: { count: parts.count } })}
{:else}
	{$date(new Date(iso), { month: 'short', day: 'numeric', year: 'numeric' })}
{/if}
