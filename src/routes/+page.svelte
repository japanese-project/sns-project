<script lang="ts">
	import { resolve } from '$app/paths'
	import { sign_out } from '$lib/auth-client'

	let { data } = $props()

	async function handle_sign_out() {
		await sign_out()
		window.location.href = '/login'
	}
</script>

<svelte:head>
	<title>Home</title>
</svelte:head>

<div class="min-h-screen p-6">
	<div class="mx-auto max-w-xl space-y-6">
		<header class="flex items-center justify-between border-b pb-4">
			<h1 class="text-2xl font-bold">Welcome, {data.user.name}!</h1>

			<div class="flex items-center gap-3">
				<a
					href={resolve('/profile')}
					class="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
				>
					Profile
				</a>
				<button
					onclick={handle_sign_out}
					class="rounded border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
				>
					Sign Out
				</button>
			</div>
		</header>

		<div class="rounded border p-6">
			<p class="text-gray-600">You are logged in to SNS.</p>
		</div>
	</div>
</div>
