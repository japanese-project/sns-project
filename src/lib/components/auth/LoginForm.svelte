<script lang="ts">
	import { sign_in_with_google } from '$lib/auth-client'
	import { Button } from '$lib/components/ui/button/index.js'

	let loading = $state(false)
	let error_message = $state<string | null>(null)

	async function handle_google_login() {
		loading = true
		error_message = null
		try {
			await sign_in_with_google()
		} catch (e) {
			loading = false
			error_message =
				e instanceof Error ? e.message : 'Unable to connect to Google. Please try again.'
		}
	}
</script>

<div class="w-full max-w-[29rem] max-[375px]:max-w-[18rem]">
	<div class="mb-8 max-[375px]:mb-5">
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

	<div class="grid gap-4">
		<Button
			variant="outline"
			type="button"
			onclick={handle_google_login}
			disabled={loading}
			class="h-[3.45rem] w-full gap-3 rounded-2xl border-[#dfe3eb] bg-white text-base font-bold text-[#25314b] shadow-sm transition hover:-translate-y-px hover:border-slate-400 hover:bg-slate-50 hover:shadow max-[375px]:h-12 max-[375px]:text-sm"
		>
			<svg class="size-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
			{loading ? 'Connecting to Google…' : 'Continue with Google'}
		</Button>

		{#if error_message}
			<p
				class="rounded-xl bg-rose-50 px-4 py-3 text-center text-xs font-medium text-rose-700"
				role="alert"
			>
				{error_message}
			</p>
		{/if}

		<div
			class="mt-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-xs leading-5 text-slate-500"
		>
			<p class="font-semibold text-slate-700">Passwordless authentication</p>
			<p class="mt-1">
				Loop uses Google OAuth for instant, secure sign-in. Your account and profile are
				automatically created on your first login.
			</p>
		</div>
	</div>
</div>
