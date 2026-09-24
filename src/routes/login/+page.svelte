<script lang="ts">
	import { sign_in_with_google } from '$lib/auth-client'

	let loading = $state(false)

	async function handle_login() {
		loading = true
		try {
			await sign_in_with_google()
		} catch {
			loading = false
		}
	}
</script>

<svelte:head>
	<title>Login</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center p-4">
	<div class="w-full max-w-sm rounded border p-6 text-center">
		<h1 class="mb-4 text-2xl font-bold">Sign In</h1>
		<p class="mb-6 text-sm text-gray-600">Sign in with your Google account to continue.</p>

		<button
			onclick={handle_login}
			disabled={loading}
			class="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
		>
			{loading ? 'Connecting…' : 'Sign in with Google'}
		</button>
	</div>
</div>
