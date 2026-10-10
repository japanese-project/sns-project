<script lang="ts">
	import EyeIcon from '@lucide/svelte/icons/eye'
	import EyeOffIcon from '@lucide/svelte/icons/eye-off'
	import LockKeyholeIcon from '@lucide/svelte/icons/lock-keyhole'
	import MailIcon from '@lucide/svelte/icons/mail'
	import { Button } from '$lib/components/ui/button/index.js'
	import { Input } from '$lib/components/ui/input/index.js'
	import { Label } from '$lib/components/ui/label/index.js'
	import type { HTMLInputAttributes } from 'svelte/elements'

	let {
		label,
		name,
		type = 'text',
		placeholder,
		autocomplete,
		value = $bindable(),
	}: {
		label: string
		name: string
		type?: 'email' | 'password' | 'text'
		placeholder: string
		autocomplete?: HTMLInputAttributes['autocomplete']
		value?: string
	} = $props()

	let show_password = $state(false)
	let input_type = $derived(type === 'password' && show_password ? 'text' : type)
</script>

<div class="grid gap-2 max-[375px]:gap-1.5">
	<Label for={name} class="text-sm font-bold text-[#25314b] max-[375px]:text-xs dark:text-slate-100"
		>{label}</Label
	>
	<div class="relative flex items-center">
		{#if type === 'email'}
			<MailIcon
				class="pointer-events-none absolute left-4 z-10 size-[1.1rem] text-[#8c95a8] dark:text-slate-500"
				aria-hidden="true"
			/>
		{:else}
			<LockKeyholeIcon
				class="pointer-events-none absolute left-4 z-10 size-[1.1rem] text-[#8c95a8] dark:text-slate-500"
				aria-hidden="true"
			/>
		{/if}

		<Input
			id={name}
			bind:value
			{name}
			type={input_type}
			{placeholder}
			{autocomplete}
			required
			class="h-[3.35rem] rounded-[0.85rem] border-[#dfe3eb] bg-[#fbfcfe] pr-14 pl-12 text-[0.94rem] text-[#17233c] shadow-none placeholder:text-[#a3aaba] focus-visible:border-primary focus-visible:bg-white focus-visible:ring-primary/15 max-[375px]:h-12 max-[375px]:text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus-visible:bg-slate-900"
		/>

		{#if type === 'password'}
			<Button
				variant="ghost"
				size="icon-sm"
				class="absolute right-2 text-[#59647a] hover:bg-transparent hover:text-primary"
				type="button"
				onclick={() => (show_password = !show_password)}
				aria-label={show_password ? 'Hide password' : 'Show password'}
			>
				{#if show_password}
					<EyeOffIcon class="size-4" />
				{:else}
					<EyeIcon class="size-4" />
				{/if}
			</Button>
		{/if}
	</div>
</div>
