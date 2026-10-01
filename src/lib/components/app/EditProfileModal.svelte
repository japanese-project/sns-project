<script lang="ts">
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import XIcon from '@lucide/svelte/icons/x'
	import { api } from '$lib/api'
	import { MAX_BIO_LENGTH, MAX_NAME_LENGTH } from '$lib/limits'
	import type { UserSummary } from '$lib/types'

	let {
		user,
		current_interests = [],
		on_close,
		on_saved,
	}: {
		user: UserSummary & { bio?: string | null }
		current_interests?: string[]
		on_close: () => void
		on_saved: (updated: UserSummary & { bio?: string | null; interests?: string[] }) => void
	} = $props()

	const available_interests = [
		'Technology',
		'Design',
		'Photography',
		'Music',
		'Writing',
		'Gaming',
		'Science',
		'Travel',
		'Art',
		'Food & Cooking',
		'Books',
		'Open Source',
	]

	let name = $state('')
	let username = $state('')
	let bio = $state('')
	let selected_interests = $state<string[]>([])
	let saving = $state(false)
	let error_message = $state<string | null>(null)

	$effect(() => {
		name = user.name
		username = user.username ?? ''
		bio = user.bio ?? ''
		selected_interests = [...current_interests]
	})

	function toggle_interest(item: string) {
		if (selected_interests.includes(item)) {
			selected_interests = selected_interests.filter((i) => i !== item)
		} else {
			selected_interests = [...selected_interests, item]
		}
	}

	let custom_input = $state('')
	let custom_interests = $derived(
		selected_interests.filter((i) => !available_interests.includes(i)),
	)

	function add_custom() {
		const val = custom_input.trim()
		if (!val || selected_interests.includes(val)) {
			custom_input = ''
			return
		}
		selected_interests = [...selected_interests, val]
		custom_input = ''
	}

	function remove_custom(item: string) {
		selected_interests = selected_interests.filter((i) => i !== item)
	}

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
			const updated = await api<UserSummary & { bio: string | null; interests: string | null }>(
				'/api/users/me',
				{
					method: 'PATCH',
					body: {
						name: trimmed_name,
						username: trimmed_username,
						bio: trimmed_bio.length > 0 ? trimmed_bio : null,
						interests: selected_interests,
					},
				},
			)
			// Parse interests back to array for the caller
			let parsed_interests: string[] = []
			if (updated.interests) {
				try {
					parsed_interests = JSON.parse(updated.interests)
				} catch {
					parsed_interests = []
				}
			}
			on_saved({ ...updated, interests: parsed_interests })
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

<!-- Backdrop -->
<div
	class="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
	onclick={on_close}
	role="presentation"
></div>

<!-- Slide-in sheet from right -->
<div
	class="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-[#f8fafc] shadow-2xl"
	role="dialog"
	aria-modal="true"
	aria-labelledby="edit-profile-title"
>
	<!-- Header bar -->
	<div class="flex items-center justify-between border-b border-slate-200/60 px-5 py-4">
		<h2 id="edit-profile-title" class="text-base font-bold text-slate-900">Edit Profile</h2>
		<button
			type="button"
			onclick={on_close}
			aria-label="Close"
			class="flex size-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
		>
			<XIcon class="size-4" />
		</button>
	</div>

	<!-- Scrollable body -->
	<form onsubmit={handle_submit} class="flex flex-1 flex-col overflow-y-auto">
		<div class="flex-1 space-y-6 px-5 py-6">
			<!-- Display Name -->
			<div>
				<label
					for="profile-name"
					class="block text-[0.7rem] font-bold tracking-wider text-slate-500 uppercase"
				>
					Display Name
				</label>
				<input
					id="profile-name"
					type="text"
					bind:value={name}
					maxlength={MAX_NAME_LENGTH}
					required
					class="mt-2 w-full border-0 border-b-2 border-slate-200 bg-transparent pb-1.5 text-sm text-slate-900 transition outline-none focus:border-slate-900 focus:ring-0 focus:outline-none"
				/>
			</div>

			<!-- Username -->
			<div>
				<label
					for="profile-username"
					class="block text-[0.7rem] font-bold tracking-wider text-slate-500 uppercase"
				>
					Username
				</label>
				<div class="relative mt-2">
					<span
						class="pointer-events-none absolute inset-y-0 left-0 flex items-center pb-1.5 text-sm font-semibold text-slate-400"
						>@</span
					>
					<input
						id="profile-username"
						type="text"
						bind:value={username}
						maxlength={30}
						placeholder="username"
						class="w-full border-0 border-b-2 border-slate-200 bg-transparent pb-1.5 pl-5 text-sm text-slate-900 transition outline-none focus:border-slate-900 focus:ring-0 focus:outline-none"
					/>
				</div>
				<p class="mt-1 text-[0.68rem] text-slate-400">
					Lowercase letters, numbers, and underscores.
				</p>
			</div>

			<!-- Bio -->
			<div>
				<div class="flex items-center justify-between">
					<label
						for="profile-bio"
						class="block text-[0.7rem] font-bold tracking-wider text-slate-500 uppercase"
					>
						Bio
					</label>
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
					class="mt-2 w-full resize-none border-0 border-b-2 border-slate-200 bg-transparent pb-1.5 text-sm leading-relaxed text-slate-900 transition outline-none focus:border-slate-900 focus:ring-0 focus:outline-none"
				></textarea>
			</div>

			<!-- Interests / Hashtag Topics -->
			<div>
				<p class="block text-[0.7rem] font-bold tracking-wider text-slate-500 uppercase">
					Topics you enjoy
				</p>
				<p class="mt-0.5 text-[0.68rem] text-slate-400">These appear as #tags on your profile.</p>
				<div class="mt-3 flex flex-wrap gap-2">
					{#each available_interests as topic (topic)}
						{@const is_selected = selected_interests.includes(topic)}
						<button
							type="button"
							onclick={() => toggle_interest(topic)}
							class="rounded-full px-3.5 py-1.5 text-xs font-semibold transition {is_selected
								? 'bg-slate-900 text-white shadow-sm'
								: 'text-slate-600 hover:bg-slate-100'}"
						>
							{is_selected ? '✓ ' : '#'}{topic}
						</button>
					{/each}
					{#each custom_interests as topic (topic)}
						<span
							class="flex items-center gap-1 rounded-full bg-indigo-600 py-1.5 pr-2 pl-3.5 text-xs font-semibold text-white shadow-sm"
						>
							#{topic}
							<button
								type="button"
								onclick={() => remove_custom(topic)}
								class="ml-0.5 opacity-70 hover:opacity-100"
								aria-label="Remove {topic}">✕</button
							>
						</span>
					{/each}
				</div>
				<!-- Custom interest input -->
				<div class="mt-3 flex gap-2">
					<input
						type="text"
						bind:value={custom_input}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault()
								add_custom()
							}
						}}
						placeholder="Add your own…"
						maxlength={30}
						class="flex-1 border-0 border-b-2 border-slate-200 bg-transparent pb-1.5 text-sm text-slate-900 transition outline-none placeholder:text-slate-400 focus:border-slate-900 focus:ring-0 focus:outline-none"
					/>
					<button
						type="button"
						onclick={add_custom}
						class="rounded-full px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
					>
						Add
					</button>
				</div>
			</div>

			{#if error_message}
				<p class="rounded-2xl bg-rose-50 px-4 py-3 text-xs text-rose-700" role="alert">
					{error_message}
				</p>
			{/if}
		</div>

		<!-- Sticky footer actions -->
		<div
			class="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200/60 px-5 py-4"
		>
			<button
				type="button"
				onclick={on_close}
				class="rounded-full px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={saving || !name.trim()}
				class="rounded-full bg-black px-6 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
			>
				{saving ? 'Saving…' : 'Save'}
			</button>
		</div>
	</form>
</div>
