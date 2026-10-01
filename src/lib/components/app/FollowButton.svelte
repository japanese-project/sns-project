<script lang="ts">
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import { api } from '$lib/api'

	let {
		handle,
		following: server_following,
		follows_you = false,
		signed_in = true,
		label_following = 'Following',
		label_follow,
		on_change,
	}: {
		handle: string
		following: boolean
		follows_you?: boolean
		signed_in?: boolean
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
		if (!signed_in) {
			void goto(resolve('/login'))
			return
		}
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

<span class="inline-flex flex-col items-end">
	<button
		type="button"
		onclick={toggle}
		disabled={pending}
		aria-pressed={following}
		class="rounded-full px-4 py-1.5 text-xs font-semibold transition disabled:opacity-60 {following
			? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
			: follows_you
				? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
				: 'bg-black text-white hover:bg-slate-800'}"
	>
		{following ? label_following : follow_label}
	</button>
	{#if error_message}
		<span class="mt-1 text-xs text-rose-600" role="alert">{error_message}</span>
	{/if}
</span>
