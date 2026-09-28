<script lang="ts">
	import { resolve } from '$app/paths'
	import { sign_out } from '$lib/auth-client'

	let { data } = $props()

	let custom_username = $state<string | null>(null)
	let bio = $state('No bio yet.')
	let is_editing_username = $state(false)
	let is_editing_bio = $state(false)
	let temp_username = $state('')
	let temp_bio = $state('')

	const username = $derived(custom_username ?? data.user.email?.split('@')[0] ?? 'username')

	function start_editing_username() {
		temp_username = username
		is_editing_username = true
	}

	function save_username() {
		custom_username = temp_username.trim() || username
		is_editing_username = false
	}

	function start_editing_bio() {
		temp_bio = bio
		is_editing_bio = true
	}

	function save_bio() {
		bio = temp_bio.trim() || bio
		is_editing_bio = false
	}

	async function handle_sign_out() {
		await sign_out()
		window.location.href = '/login'
	}
</script>

<svelte:head>
	<title>Profile — {data.user.name}</title>
</svelte:head>

<div class="min-h-screen p-6">
	<div class="mx-auto max-w-xl space-y-6">
		<!-- Header / Navigation -->
		<div class="flex items-center justify-between border-b pb-4">
			<a
				href={resolve('/')}
				class="rounded border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
			>
				← Back to Home
			</a>

			<button
				onclick={handle_sign_out}
				class="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
			>
				Sign Out
			</button>
		</div>

		<!-- Profile Info -->
		<div class="space-y-6 rounded border p-6">
			<!-- User Header -->
			<div class="flex items-center gap-4">
				{#if data.user.image}
					<img
						src={data.user.image}
						alt={data.user.name}
						class="h-16 w-16 rounded-full border object-cover"
					/>
				{:else}
					<div
						class="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-xl font-bold text-gray-600"
					>
						{data.user.name?.charAt(0) ?? '?'}
					</div>
				{/if}

				<div>
					<h1 class="text-xl font-bold">{data.user.name}</h1>
					<p class="text-sm text-gray-500">{data.user.email}</p>
				</div>
			</div>

			<!-- Followers & Following -->
			<div class="flex gap-6 border-y py-3 text-sm">
				<div>
					<span class="font-bold">0</span>
					<span class="text-gray-600">Followers</span>
				</div>
				<div>
					<span class="font-bold">0</span>
					<span class="text-gray-600">Following</span>
				</div>
			</div>

			<!-- Username (with Edit button) -->
			<div class="space-y-1">
				<div class="flex items-center justify-between">
					<label for="username-input" class="text-xs font-semibold text-gray-500 uppercase"
						>Username</label
					>
					{#if !is_editing_username}
						<button onclick={start_editing_username} class="text-xs text-blue-600 hover:underline">
							Edit
						</button>
					{/if}
				</div>

				{#if is_editing_username}
					<div class="flex gap-2">
						<input
							id="username-input"
							type="text"
							bind:value={temp_username}
							class="flex-1 rounded border px-3 py-1.5 text-sm"
						/>
						<button
							onclick={save_username}
							class="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
						>
							Save
						</button>
						<button
							onclick={() => (is_editing_username = false)}
							class="rounded border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
						>
							Cancel
						</button>
					</div>
				{:else}
					<p class="text-sm font-medium text-gray-900">@{username}</p>
				{/if}
			</div>

			<!-- Bio (with Edit button) -->
			<div class="space-y-1">
				<div class="flex items-center justify-between">
					<label for="bio-input" class="text-xs font-semibold text-gray-500 uppercase">Bio</label>
					{#if !is_editing_bio}
						<button onclick={start_editing_bio} class="text-xs text-blue-600 hover:underline">
							Edit
						</button>
					{/if}
				</div>

				{#if is_editing_bio}
					<div class="space-y-2">
						<textarea
							id="bio-input"
							bind:value={temp_bio}
							rows="3"
							class="w-full rounded border p-2 text-sm"></textarea>
						<div class="flex gap-2">
							<button
								onclick={save_bio}
								class="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
							>
								Save
							</button>
							<button
								onclick={() => (is_editing_bio = false)}
								class="rounded border px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
							>
								Cancel
							</button>
						</div>
					</div>
				{:else}
					<p class="text-sm text-gray-700">{bio}</p>
				{/if}
			</div>
		</div>
	</div>
</div>
