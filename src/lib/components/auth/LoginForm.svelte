<script lang="ts">
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right'
	import { resolve } from '$app/paths'
	import { Button } from '$lib/components/ui/button/index.js'
	import { Checkbox } from '$lib/components/ui/checkbox/index.js'
	import { Label } from '$lib/components/ui/label/index.js'
	import { Separator } from '$lib/components/ui/separator/index.js'

	let email = $state('')
	let password = $state('')
	let remember_me = $state(false)
	let form_notice = $state('')

	function handle_submit() {
		form_notice = 'Your sign-in form is ready to connect to authentication.'
	}
</script>

<div class="w-full max-w-[29rem] max-[375px]:max-w-[18rem]">
	<div class="mb-7 max-[375px]:mb-5">
		<p
			class="mb-2 text-xs font-extrabold tracking-[0.12em] text-primary uppercase max-[375px]:text-[0.68rem]"
		>
			Welcome back
		</p>
		<h1
			class="m-0 text-[clamp(2rem,4vw,2.55rem)] leading-[1.08] font-extrabold tracking-[-0.055em] text-[#15213a] max-[375px]:text-[1.75rem]"
		>
			Good to see you again.
		</h1>
		<p
			class="mt-3 text-[0.94rem] leading-6 text-[#727c90] max-[375px]:mt-2 max-[375px]:text-sm max-[375px]:leading-5"
		>
			Sign in to catch up with your people and conversations.
		</p>
	</div>

	<div class="grid grid-cols-2 gap-3 max-[375px]:gap-2" aria-label="Social sign in options">
		<Button
			variant="outline"
			type="button"
			class="h-[3.15rem] gap-3 rounded-xl border-[#dfe3eb] bg-white text-sm font-bold text-[#25314b] shadow-none hover:-translate-y-px hover:bg-white hover:shadow-sm max-[375px]:h-11 max-[375px]:gap-2 max-[375px]:text-xs"
		>
			<svg class="size-[1.15rem]" viewBox="0 0 24 24" aria-hidden="true">
				<path
					fill="#4285f4"
					d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.4 2.9-7.5"
				/>
				<path
					fill="#34a853"
					d="M12 22c2.7 0 5-.9 6.7-2.3l-3.3-2.6c-.9.6-2.1 1-3.4 1-2.6 0-4.9-1.8-5.7-4.2H2.9v2.7A10 10 0 0 0 12 22"
				/>
				<path
					fill="#fbbc05"
					d="M6.3 13.9A6 6 0 0 1 6 12c0-.7.1-1.3.3-1.9V7.4H2.9A10 10 0 0 0 2 12c0 1.7.4 3.2.9 4.6z"
				/>
				<path
					fill="#ea4335"
					d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.8A9.8 9.8 0 0 0 2.9 7.4l3.4 2.7c.8-2.4 3.1-4.2 5.7-4.2"
				/>
			</svg>
			Google
		</Button>
		<Button
			variant="outline"
			type="button"
			class="h-[3.15rem] gap-3 rounded-xl border-[#dfe3eb] bg-white text-sm font-bold text-[#25314b] shadow-none hover:-translate-y-px hover:bg-white hover:shadow-sm max-[375px]:h-11 max-[375px]:gap-2 max-[375px]:text-xs"
		>
			<svg class="size-[1.15rem]" viewBox="0 0 24 24" aria-hidden="true">
				<path
					d="M17.1 12.5c0-2.7 2.2-4 2.3-4.1a5 5 0 0 0-3.9-2.1c-1.7-.2-3.2 1-4.1 1-.9 0-2.2-1-3.7-1A5.4 5.4 0 0 0 3.2 9c-1.9 3.3-.5 8.2 1.3 10.9.9 1.3 2 2.8 3.4 2.7 1.4-.1 1.9-.9 3.6-.9s2.2.9 3.6.9c1.5 0 2.5-1.3 3.4-2.6a12 12 0 0 0 1.5-3.2 4.7 4.7 0 0 1-2.9-4.3M14.4 4.6a4.8 4.8 0 0 0 1.1-3.4 4.9 4.9 0 0 0-3.2 1.7 4.5 4.5 0 0 0-1.1 3.3 4.1 4.1 0 0 0 3.2-1.6"
				/>
			</svg>
			Apple
		</Button>
	</div>

	<div
		class="my-6 flex items-center gap-3 text-xs whitespace-nowrap text-[#9ba2b1] max-[375px]:my-4 max-[375px]:gap-2 max-[375px]:text-[0.68rem]"
	>
		<Separator class="min-w-0 flex-1 shrink" />
		<span>or continue with email</span>
		<Separator class="min-w-0 flex-1 shrink" />
	</div>

	<form
		class="grid gap-[1.15rem] max-[375px]:gap-3"
		onsubmit={(event) => {
			event.preventDefault()
			handle_submit()
		}}
	>
		<div class="grid gap-2">
			<Label for="email" class="text-sm font-bold text-[#25314b]">Email address</Label>
			<input
				id="email"
				name="email"
				type="email"
				placeholder="you@example.com"
				autocomplete="email"
				bind:value={email}
				required
				class="h-[3.15rem] rounded-xl border border-[#dfe3eb] bg-white px-4 text-sm text-[#25314b] outline-none transition placeholder:text-[#9ba2b1] focus:border-primary focus:ring-2 focus:ring-primary/15"
			/>
		</div>
		<div class="grid gap-2">
			<Label for="password" class="text-sm font-bold text-[#25314b]">Password</Label>
			<input
				id="password"
				name="password"
				type="password"
				placeholder="Enter your password"
				autocomplete="current-password"
				bind:value={password}
				required
				class="h-[3.15rem] rounded-xl border border-[#dfe3eb] bg-white px-4 text-sm text-[#25314b] outline-none transition placeholder:text-[#9ba2b1] focus:border-primary focus:ring-2 focus:ring-primary/15"
			/>
		</div>

		<div class="flex items-center justify-between gap-2 text-[0.82rem] max-[375px]:text-[0.72rem]">
			<div class="flex items-center gap-2">
				<Checkbox
					id="remember_me"
					bind:checked={remember_me}
					class="data-checked:border-primary data-checked:bg-primary"
				/>
				<Label for="remember_me" class="cursor-pointer font-normal text-[#59647a]"
					>Remember me</Label
				>
			</div>
			<Button
				variant="link"
				href={resolve('/forgot-password')}
				class="h-auto p-0 font-bold text-[inherit] text-primary">Forgot password?</Button
			>
		</div>

		<Button
			class="h-[3.45rem] rounded-[0.9rem] text-[0.92rem] font-extrabold shadow-[0_12px_25px_rgba(255,104,71,0.26)] hover:-translate-y-px hover:bg-[#f45a37] max-[375px]:h-12"
			type="submit"
		>
			Sign in
			<ArrowRightIcon data-icon="inline-end" class="size-4" />
		</Button>

		{#if form_notice}
			<p
				class="-mt-1 rounded-lg bg-primary/10 px-3 py-3 text-center text-xs leading-5 text-[#a43c25]"
				role="status"
			>
				{form_notice}
			</p>
		{/if}
	</form>

	<div
		class="mt-6 flex items-center justify-center gap-1 text-sm text-[#7a8395] max-[375px]:mt-4 max-[375px]:text-xs"
	>
		<span>New to Loop?</span>
		<Button
			variant="link"
			href={resolve('/register')}
			class="h-auto p-0 font-bold text-[inherit] text-primary">Create an account</Button
		>
	</div>
</div>
