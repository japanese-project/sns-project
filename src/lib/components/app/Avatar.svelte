<script lang="ts">
	import type { UserSummary } from '$lib/types'

	let {
		user,
		size = 40,
		ring = false,
	}: {
		user: { name: string; image?: UserSummary['image'] | undefined }
		size?: number
		ring?: boolean
	} = $props()
	let initial = $derived(user.name?.trim().charAt(0).toUpperCase() || '?')
</script>

<span
	class="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 font-semibold text-slate-600 {ring
		? 'ring-2 ring-blue-500 ring-offset-2'
		: ''}"
	style="width:{size}px;height:{size}px;font-size:{size * 0.4}px"
>
	{#if user.image}
		<img
			src={user.image}
			alt={user.name}
			class="h-full w-full object-cover"
			referrerpolicy="no-referrer"
		/>
	{:else}
		{initial}
	{/if}
</span>
