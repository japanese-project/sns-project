<script lang="ts">
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import { api } from '$lib/api'
	import { MAX_BIO_LENGTH, MAX_NAME_LENGTH } from '$lib/limits'
	import type { UserSummary } from '$lib/types'

	let {
		user,
		on_close,
		on_saved,
	}: {
		user: UserSummary & { bio?: string | null }
		on_close: () => void
		on_saved: (updated: UserSummary & { bio?: string | null }) => void
	} = $props()

	let name = $state('')
	let username = $state('')
	let bio = $state('')
	let saving = $state(false)
	let error_message = $state<string | null>(null)

	$effect(() => {
		name = user.name
		username = user.username ?? ''
		bio = user.bio ?? ''
	})

	async function handle_submit(event: SubmitEvent) {
		event.preventDefault()
		const trimmed_name = name.trim()
		const trimmed_username = username.trim().toLowerCase()
		const trimmed_bio = bio.trim()

		if (!trimmed_name || trimmed_name.length > MAX_NAME_LENGTH) {
			error_message = `Name must be between 1 and ${MAX_NAME_LENGTH} characters.`
			return
		}
		if (trimmed_username && !/^[a-z0-9_]{3,30}$/.test(trimmed_username)) {
			error_message =
				'Username must be 3–30 characters and contain only lowercase letters, numbers, and underscores.'
			return
		}
		if (trimmed_bio.length > MAX_BIO_LENGTH) {
			error_message = `Bio cannot exceed ${MAX_BIO_LENGTH} characters.`
			return
		}

		saving = true
		error_message = null

		try {
			const updated = await api<UserSummary & { bio: string | null }>('/api/users/me', {
				method: 'PATCH',
				body: {
					name: trimmed_name,
					username: trimmed_username,
					bio: trimmed_bio.length > 0 ? trimmed_bio : null,
				},
			})
			on_saved(updated)
			on_close()
			if (updated.handle !== user.handle) {
				void goto(resolve('/u/[handle]', { handle: updated.handle }))
			}
		} catch (e) {
			error_message = e instanceof Error ? e.message : 'Failed to update profile.'
		} finally {
			saving = false
		}
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
	role="dialog"
	aria-modal="true"
	aria-labelledby="edit-profile-title"
>
	<div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
		<div class="flex items-center justify-between border-b border-slate-100 pb-4">
			<h2 id="edit-profile-title" class="text-lg font-bold text-slate-900">Edit Profile</h2>
			<button
				type="button"
				onclick={on_close}
				aria-label="Close dialog"
				class="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
			>
				✕
			</button>
		</div>

		<form onsubmit={handle_submit} class="mt-5 space-y-4">
			<div>
				<label for="profile-name" class="block text-xs font-bold text-slate-700 uppercase"
					>Display Name</label
				>
				<input
					id="profile-name"
					type="text"
					bind:value={name}
					maxlength={MAX_NAME_LENGTH}
					required
					class="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-black focus:ring-2 focus:ring-black/10"
				/>
			</div>

			<div>
				<label for="profile-username" class="block text-xs font-bold text-slate-700 uppercase"
					>Username</label
				>
				<div class="relative mt-1.5">
					<span
						class="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-slate-400"
						>@</span
					>
					<input
						id="profile-username"
						type="text"
						bind:value={username}
						maxlength={30}
						placeholder="username"
						class="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pr-3.5 pl-8 text-sm text-slate-900 outline-none focus:border-black focus:ring-2 focus:ring-black/10"
					/>
				</div>
				<p class="mt-1 text-[0.7rem] text-slate-400">
					Lowercase letters, numbers, and underscores.
				</p>
			</div>

			<div>
				<div class="flex items-center justify-between">
					<label for="profile-bio" class="block text-xs font-bold text-slate-700 uppercase"
						>Bio</label
					>
					<span
						class="text-xs tabular-nums {bio.length > MAX_BIO_LENGTH
							? 'font-semibold text-rose-600'
							: 'text-slate-400'}"
					>
						{MAX_BIO_LENGTH - bio.length}
					</span>
				</div>
				<textarea
					id="profile-bio"
					bind:value={bio}
					rows="3"
					maxlength={MAX_BIO_LENGTH}
					placeholder="Tell people a little bit about yourself…"
					class="mt-1.5 w-full resize-none rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-black focus:ring-2 focus:ring-black/10"
				></textarea>
			</div>

			{#if error_message}
				<p class="rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700" role="alert">
					{error_message}
				</p>
			{/if}

			<div class="flex justify-end gap-2.5 pt-2">
				<button
					type="button"
					onclick={on_close}
					class="rounded-full px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={saving || !name.trim()}
					class="rounded-full bg-black px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
				>
					{saving ? 'Saving…' : 'Save'}
				</button>
			</div>
		</form>
	</div>
</div>
