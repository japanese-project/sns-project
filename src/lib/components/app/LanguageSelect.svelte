<script lang="ts">
	// Two presentations of the same switcher:
	//   'segmented' — the compact pill of locale buttons, used on the login page where there is no
	//                 nav rail to fold a menu into.
	//   'icon'      — a single icon button that opens a menu, used in the nav dock so the rail keeps
	//                 one square per item instead of a three-button pill.
	// The menu wiring (arrow keys, Escape, Tab, click-outside) mirrors the hand-rolled menu in
	// PostCard.svelte rather than pulling in bits-ui, which this codebase only uses for primitives.
	import CheckIcon from '@lucide/svelte/icons/check'
	import LanguagesIcon from '@lucide/svelte/icons/languages'
	import { current_locale, set_locale, supported_locales, t, type Locale } from '$lib/i18n'

	let {
		variant = 'segmented',
		placement = 'right',
		class: button_class = '',
	}: {
		variant?: 'segmented' | 'icon'
		/** Where the menu anchors when it opens: beside a vertical rail, or above a bottom pill. */
		placement?: 'right' | 'up'
		/** Trigger button classes. Callers pass their own nav-button styling so the switcher matches. */
		class?: string
	} = $props()

	const menu_id = 'language-menu'

	let active = $state(current_locale())
	let switching = $state(false)

	let menu_open = $state(false)
	let menu_container_el = $state<HTMLElement | null>(null)
	let menu_button_el = $state<HTMLButtonElement | null>(null)
	let menu_el = $state<HTMLElement | null>(null)

	async function choose(code: Locale) {
		close_menu(true)
		if (code === active) return
		switching = true
		active = code
		await set_locale(code)
		switching = false
	}

	function menu_items(): HTMLElement[] {
		if (!menu_el) return []
		return Array.from(menu_el.querySelectorAll<HTMLElement>('[role="menuitemradio"]'))
	}

	function close_menu(restore_focus = true) {
		menu_open = false
		if (restore_focus) {
			menu_button_el?.focus()
		}
	}

	function open_menu(focus_target: 'first' | 'last' = 'first') {
		menu_open = true
		queueMicrotask(() => {
			const items = menu_items()
			if (items.length === 0) return
			const item = focus_target === 'first' ? items[0] : items[items.length - 1]
			item?.focus()
		})
	}

	function handle_button_keydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			event.preventDefault()
			event.stopPropagation()
			open_menu('first')
		} else if (event.key === 'ArrowUp') {
			event.preventDefault()
			event.stopPropagation()
			open_menu('last')
		}
	}

	function handle_menu_keydown(event: KeyboardEvent) {
		if (!menu_open) return

		const items = menu_items()
		if (items.length === 0) return

		const current_index = items.findIndex((item) => item === document.activeElement)

		switch (event.key) {
			case 'ArrowDown': {
				event.preventDefault()
				event.stopPropagation()
				const next_index =
					current_index === -1 || current_index === items.length - 1 ? 0 : current_index + 1
				items[next_index]?.focus()
				break
			}
			case 'ArrowUp': {
				event.preventDefault()
				event.stopPropagation()
				const prev_index = current_index <= 0 ? items.length - 1 : current_index - 1
				items[prev_index]?.focus()
				break
			}
			case 'Home': {
				event.preventDefault()
				event.stopPropagation()
				items[0]?.focus()
				break
			}
			case 'End': {
				event.preventDefault()
				event.stopPropagation()
				items[items.length - 1]?.focus()
				break
			}
			case 'Escape': {
				event.preventDefault()
				event.stopPropagation()
				close_menu(true)
				break
			}
			case 'Tab': {
				close_menu(false)
				break
			}
		}
	}

	$effect(() => {
		if (!menu_open) return
		function handle_doc_click(e: MouseEvent) {
			if (menu_container_el && !menu_container_el.contains(e.target as Node)) {
				close_menu(false)
			}
		}
		function handle_doc_keydown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				close_menu(true)
			}
		}
		window.addEventListener('click', handle_doc_click)
		window.addEventListener('keydown', handle_doc_keydown)
		return () => {
			window.removeEventListener('click', handle_doc_click)
			window.removeEventListener('keydown', handle_doc_keydown)
		}
	})
</script>

{#if variant === 'segmented'}
	<div
		role="group"
		aria-label={$t('language.label')}
		aria-busy={switching}
		class="inline-flex items-center rounded-full bg-slate-100 p-0.5 text-[10px] font-semibold"
	>
		{#each supported_locales as option (option.code)}
			<button
				type="button"
				lang={option.code}
				aria-pressed={active === option.code}
				onclick={() => choose(option.code)}
				class="rounded-full px-2 py-0.5 transition {active === option.code
					? 'bg-white text-slate-900 shadow-xs'
					: 'text-slate-500 hover:text-slate-900'}"
			>
				{option.code === 'en' ? 'EN' : option.name}
			</button>
		{/each}
	</div>
{:else}
	<div class="relative" bind:this={menu_container_el}>
		<button
			type="button"
			bind:this={menu_button_el}
			aria-label={$t('language.change')}
			title={$t('language.change')}
			aria-haspopup="menu"
			aria-expanded={menu_open}
			aria-controls={menu_open ? menu_id : undefined}
			aria-busy={switching}
			onkeydown={handle_button_keydown}
			onclick={() => {
				if (menu_open) close_menu(false)
				else open_menu('first')
			}}
			class={button_class}
		>
			<LanguagesIcon class="size-5" />
		</button>

		{#if menu_open}
			<div
				bind:this={menu_el}
				id={menu_id}
				role="menu"
				tabindex="-1"
				aria-label={$t('language.label')}
				aria-busy={switching}
				onkeydown={handle_menu_keydown}
				class="absolute z-50 w-40 overflow-hidden rounded-2xl border border-border bg-popover py-1.5 text-popover-foreground shadow-xl shadow-black/10 focus:outline-none dark:shadow-black/40 {placement ===
				'up'
					? 'bottom-full left-1/2 mb-2 -translate-x-1/2'
					: 'top-1/2 left-full ml-2 -translate-y-1/2'}"
			>
				{#each supported_locales as option (option.code)}
					{@const selected = active === option.code}
					<button
						type="button"
						role="menuitemradio"
						tabindex="-1"
						lang={option.code}
						aria-checked={selected}
						onclick={() => choose(option.code)}
						class="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-xs font-medium transition hover:bg-accent focus:bg-accent focus:outline-none {selected
							? 'text-foreground'
							: 'text-muted-foreground'}"
					>
						<span class="grid size-3.5 shrink-0 place-items-center">
							{#if selected}
								<CheckIcon class="size-3.5" />
							{/if}
						</span>
						<span>{option.name}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>
{/if}
