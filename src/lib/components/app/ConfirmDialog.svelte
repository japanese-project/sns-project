<script lang="ts">
	let {
		title,
		message,
		confirm_label = 'Confirm',
		cancel_label = 'Cancel',
		danger = false,
		busy = false,
		on_confirm,
		on_cancel,
	}: {
		title: string
		message: string
		confirm_label?: string
		cancel_label?: string
		danger?: boolean
		busy?: boolean
		on_confirm: () => void
		on_cancel: () => void
	} = $props()
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && on_cancel()} />

<!-- Backdrop -->
<div
	class="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
	role="presentation"
	onclick={on_cancel}
></div>

<!-- Modal Container -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4"
	role="dialog"
	aria-modal="true"
	aria-labelledby="confirm-dialog-title"
>
	<div
		class="my-auto w-full max-w-sm rounded-3xl bg-[#f8fafc] p-6 shadow-2xl dark:bg-slate-900"
	>
		<h2
			id="confirm-dialog-title"
			class="text-lg font-extrabold text-slate-900 dark:text-slate-100"
		>
			{title}
		</h2>
		<p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
			{message}
		</p>

		<div class="mt-6 flex justify-end gap-2">
			<button
				type="button"
				disabled={busy}
				onclick={on_cancel}
				class="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
			>
				{cancel_label}
			</button>
			<button
				type="button"
				disabled={busy}
				onclick={on_confirm}
				class="rounded-full px-5 py-2 text-xs font-bold text-white shadow-sm transition disabled:opacity-50 {danger
					? 'bg-rose-600 hover:bg-rose-700'
					: 'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200'}"
			>
				{confirm_label}
			</button>
		</div>
	</div>
</div>
