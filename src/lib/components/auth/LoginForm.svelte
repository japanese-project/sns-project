<script lang="ts">
	import { sign_in_with_google } from '$lib/auth-client'
	import { Button } from '$lib/components/ui/button/index.js'

	let is_loading = $state(false)
	let error_message = $state<string | null>(null)

	async function handle_google_login() {
		is_loading = true
		error_message = null
		try {
			await sign_in_with_google()
		} catch (e) {
			error_message =
				e instanceof Error ? e.message : 'Unable to connect to Google. Please try again.'
		} finally {
			is_loading = false
		}
	}
</script>

<div class="mx-auto flex w-full max-w-sm flex-col gap-8">
	<div class="flex flex-col gap-2 text-center sm:text-left">
		<p class="text-xs font-bold tracking-widest text-primary uppercase">Welcome back</p>
		<h1
			class="text-[1.75rem] leading-tight font-extrabold tracking-tight text-[#15213a] sm:text-[2.25rem]"
		>
			Sign in to Loop
		</h1>
		<p class="text-[0.95rem] text-[#727c90]">Catch up with your people and conversations.</p>
	</div>

	<div class="flex flex-col gap-5">
		<Button
			variant="outline"
			type="button"
			onclick={handle_google_login}
			disabled={is_loading}
			class="relative flex h-[3.45rem] w-full items-center justify-center gap-3 rounded-xl border-[#dfe3eb] bg-white text-[0.95rem] font-bold text-[#25314b] shadow-sm transition-all hover:-translate-y-px hover:border-[#cbd1df] hover:bg-slate-50 hover:shadow-md disabled:pointer-events-none disabled:opacity-70"
		>
			{#if is_loading}
				<svg
					class="size-5 animate-spin text-[#727c90]"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
				>
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
				<span>Connecting...</span>
			{:else}
				<svg
					class="absolute left-5 size-[1.15rem] sm:static sm:size-5"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
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
				<span>Continue with Google</span>
			{/if}
		</Button>

		{#if error_message}
			<div
				class="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[0.8rem] text-rose-600 shadow-sm"
				role="alert"
			>
				<svg
					class="mt-0.5 size-4 shrink-0 text-rose-500"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></svg
				>
				<p class="leading-relaxed">{error_message}</p>
			</div>
		{/if}

		<div
			class="mt-2 flex items-center justify-center gap-3 text-[0.7rem] font-bold tracking-wider text-[#a0a7b5] uppercase before:h-px before:flex-1 before:bg-[#eff1f5] after:h-px after:flex-1 after:bg-[#eff1f5]"
		>
			Secure & Passwordless
		</div>
	</div>
</div>
