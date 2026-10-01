<script lang="ts">
	import { api } from '$lib/api'
	import { MAX_BIO_LENGTH } from '$lib/limits'

	let {
		user,
		on_done,
	}: {
		user: { name: string }
		on_done: () => void
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

	let selected_interests = $state<string[]>([])
	let bio = $state('')
	let saving = $state(false)
	let error_message = $state<string | null>(null)

	function toggle_interest(item: string) {
		if (selected_interests.includes(item)) {
			selected_interests = selected_interests.filter((i) => i !== item)
		} else {
			selected_interests = [...selected_interests, item]
		}
	}

	async function finish(skip: boolean) {
		saving = true
		error_message = null
		try {
			await api('/api/users/onboard', {
				method: 'POST',
				body: skip
					? { skip: true }
					: {
							bio: bio.trim() || null,
							interests: selected_interests,
						},
			})
			on_done()
		} catch (e) {
			error_message = e instanceof Error ? e.message : 'Could not save profile setup'
		} finally {
			saving = false
		}
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
	role="dialog"
	aria-modal="true"
	aria-labelledby="onboarding-title"
>
	<div
		class="w-full max-w-lg overflow-hidden rounded-[2.5rem] bg-white p-7 shadow-2xl ring-1 ring-slate-200"
	>
		<div class="text-center">
			<span
				class="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold tracking-wider text-indigo-600 uppercase"
				>Welcome to Loop</span
			>
			<h2 id="onboarding-title" class="mt-2 text-2xl font-extrabold text-slate-900">
				Welcome, {user.name}!
			</h2>
			<p class="mt-1 text-sm text-slate-500">
				Set up your profile to discover conversations and people you'll love.
			</p>
		</div>

		<div class="mt-6 space-y-5">
			<div>
				<label for="onboarding-bio" class="block text-xs font-bold text-slate-700 uppercase"
					>About You (optional)</label
				>
				<textarea
					id="onboarding-bio"
					bind:value={bio}
					rows="2"
					maxlength={MAX_BIO_LENGTH}
					placeholder="A sentence or two about what you do or what you love…"
					class="mt-1.5 w-full resize-none rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-black focus:ring-2 focus:ring-black/10"
				></textarea>
			</div>

			<div>
				<p class="block text-xs font-bold text-slate-700 uppercase">Pick a few topics you enjoy</p>
				<div class="mt-2 flex flex-wrap gap-2">
					{#each available_interests as topic (topic)}
						{@const is_selected = selected_interests.includes(topic)}
						<button
							type="button"
							onclick={() => toggle_interest(topic)}
							class="rounded-full px-3.5 py-1.5 text-xs font-semibold transition {is_selected
								? 'bg-slate-900 text-white shadow-sm'
								: 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}"
						>
							{is_selected ? '✓ ' : ''}{topic}
						</button>
					{/each}
				</div>
			</div>

			{#if error_message}
				<p class="rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700" role="alert">
					{error_message}
				</p>
			{/if}

			<div class="flex items-center justify-between border-t border-slate-100 pt-4">
				<button
					type="button"
					disabled={saving}
					onclick={() => finish(true)}
					class="text-xs font-semibold text-slate-500 hover:text-slate-800"
				>
					Skip for now
				</button>
				<button
					type="button"
					disabled={saving}
					onclick={() => finish(false)}
					class="rounded-full bg-black px-6 py-2.5 text-xs font-bold text-white shadow hover:bg-slate-800 disabled:opacity-50"
				>
					{saving ? 'Saving…' : 'Get Started'}
				</button>
			</div>
		</div>
	</div>
</div>
