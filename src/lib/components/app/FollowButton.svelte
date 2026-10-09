<script lang="ts">
	import { api } from '$lib/api'

	let {
		handle,
		following: server_following,
		follows_you = false,
		label_following = 'Following',
		label_follow,
		on_change,
	}: {
		handle: string
		following: boolean
		follows_you?: boolean
		label_following?: string
		label_follow?: string
		on_change?: (state: { following: boolean; follower_count: number }) => void
	} = $props()

	let override = $state<boolean | null>(null)
	let following = $derived(override ?? server_following)
	let pending = $state(false)
	let error_message = $state<string | null>(null)

	let follow_label = $derived(label_follow ?? (follows_you ? 'Follow Back' : 'Follow'))

	async function toggle() {
		if (pending) return
		const previous = following
		pending = true
		error_message = null
		override = !previous // optimistic
		try {
			const result = await api<{ following: boolean; follower_count: number }>(
				`/api/users/${encodeURIComponent(handle)}/follow`,
				{ method: previous ? 'DELETE' : 'PUT' },
			)
			override = result.following
			on_change?.(result)
		} catch (e) {
			override = previous // rollback
			error_message = e instanceof Error ? e.message : 'Could not update follow'
		} finally {
			pending = false
		}
	}
</script>

<span class="inline-flex shrink-0 flex-col items-end">
	<button
		type="button"
		onclick={toggle}
		disabled={pending}
		aria-pressed={following}
		class="inline-flex shrink-0 items-center justify-center rounded-full px-3.5 py-1 text-xs font-semibold whitespace-nowrap transition disabled:opacity-60 {following
			? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
			: follows_you
				? 'bg-indigo-600 text-white shadow-xs hover:bg-indigo-700'
				: 'bg-black text-white hover:bg-slate-800'}"
	>
		{following ? label_following : follow_label}
	</button>
	{#if error_message}
		<span class="mt-1 text-[10px] text-rose-600" role="alert">{error_message}</span>
	{/if}
</span>
