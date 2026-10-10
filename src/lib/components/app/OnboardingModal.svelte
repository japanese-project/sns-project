<script lang="ts">
	import { invalidateAll } from '$app/navigation'
	import { api } from '$lib/api'
	import { MAX_BIO_LENGTH } from '$lib/limits'
	import { t } from '$lib/i18n'

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

	let custom_input = $state('')
	let custom_interests = $derived(
		selected_interests.filter((i) => !available_interests.includes(i)),
	)

	function toggle_interest(item: string) {
		if (selected_interests.includes(item)) {
			selected_interests = selected_interests.filter((i) => i !== item)
		} else {
			selected_interests = [...selected_interests, item]
		}
	}

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
			await invalidateAll()
			on_done()
		} catch (e) {
			error_message = e instanceof Error ? e.message : $t('onboarding.error')
		} finally {
			saving = false
		}
	}
</script>

<!-- Backdrop -->
<div class="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" role="presentation"></div>

<!-- Modal Container -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
	role="dialog"
	aria-modal="true"
	aria-labelledby="onboarding-title"
>
	<div
		class="my-auto max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-[#f8fafc] p-6 shadow-2xl sm:p-7 dark:bg-slate-900"
	>
		<div class="text-center">
			<span
				class="inline-block rounded-full bg-slate-900 px-3 py-1 text-[0.7rem] font-bold tracking-wider text-white uppercase"
			>
				{$t('onboarding.badge')}
			</span>
			<h2 id="onboarding-title" class="mt-3 text-2xl font-extrabold text-slate-900">
				{$t('onboarding.title', { values: { name: user.name } })}
			</h2>
			<p class="mt-1 text-xs text-slate-500">
				{$t('onboarding.subtitle')}
			</p>
		</div>

		<div class="mt-6 space-y-6">
			<!-- Bio Input -->
			<div>
				<div class="flex items-center justify-between">
					<label
						for="onboarding-bio"
						class="block text-[0.7rem] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400"
					>
						{$t('onboarding.about_you')}
					</label>
					<span class="text-xs text-slate-400 tabular-nums dark:text-slate-500">
						{MAX_BIO_LENGTH - bio.length}
					</span>
				</div>
				<textarea
					id="onboarding-bio"
					bind:value={bio}
					rows="2"
					maxlength={MAX_BIO_LENGTH}
					placeholder={$t('onboarding.bio_placeholder')}
					class="mt-2 w-full resize-none border-0 border-b-2 border-slate-200 bg-transparent pb-1.5 text-sm leading-relaxed text-slate-900 transition outline-none placeholder:text-slate-400 focus:border-slate-900 focus:ring-0 focus:outline-none"
				></textarea>
			</div>

			<!-- Topics / Interests -->
			<div>
				<p class="block text-[0.7rem] font-bold tracking-wider text-slate-500 uppercase">
					{$t('onboarding.topics')}
				</p>
				<p class="mt-0.5 text-[0.68rem] text-slate-400">
					{$t('onboarding.topics_desc')}
				</p>
				<div class="mt-3 flex flex-wrap gap-2">
					{#each available_interests as topic (topic)}
						{@const is_selected = selected_interests.includes(topic)}
						<button
							type="button"
							onclick={() => toggle_interest(topic)}
							class="rounded-full px-3.5 py-1.5 text-xs font-semibold transition {is_selected
								? 'bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900'
								: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}"
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
								aria-label={$t('onboarding.remove_topic', { values: { topic } })}>✕</button
							>
						</span>
					{/each}
				</div>

				<!-- Other interest / custom topic input -->
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
						placeholder={$t('onboarding.add_other')}
						maxlength={30}
						class="flex-1 border-0 border-b-2 border-slate-200 bg-transparent pb-1.5 text-sm text-slate-900 transition outline-none placeholder:text-slate-400 focus:border-slate-900 focus:ring-0 focus:outline-none dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-100"
					/>
					<button
						type="button"
						onclick={add_custom}
						class="rounded-full px-3.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
					>
						{$t('common.add')}
					</button>
				</div>
			</div>

			{#if error_message}
				<p
					class="rounded-2xl bg-rose-50 px-4 py-3 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300"
					role="alert"
				>
					{error_message}
				</p>
			{/if}

			<div
				class="flex items-center justify-between border-t border-slate-200/60 pt-4 dark:border-slate-800"
			>
				<button
					type="button"
					disabled={saving}
					onclick={() => finish(true)}
					class="rounded-full px-4 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
				>
					{$t('onboarding.skip')}
				</button>
				<button
					type="submit"
					disabled={saving}
					onclick={() => finish(false)}
					class="rounded-full bg-slate-900 px-6 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
				>
					{saving ? $t('common.saving') : $t('onboarding.get_started')}
				</button>
			</div>
		</div>
	</div>
</div>
