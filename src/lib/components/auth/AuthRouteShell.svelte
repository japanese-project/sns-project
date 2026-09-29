<script lang="ts">
	import type { Snippet } from 'svelte'
	import BrandMark from './BrandMark.svelte'

	let {
		story_title,
		story_body,
		children,
	}: {
		story_title: string
		story_body: string
		children: Snippet
	} = $props()
</script>

<main class="grid min-h-svh bg-white font-sans lg:grid-cols-[0.92fr_1.08fr]">
	<section
		class="relative hidden overflow-hidden bg-[linear-gradient(145deg,rgba(19,31,58,0.96),rgba(35,48,82,0.98))] text-white lg:block"
		aria-label="About Loop"
	>
		<div
			class="pointer-events-none absolute -top-40 -right-48 size-[32rem] rounded-full bg-[radial-gradient(circle,rgba(255,107,74,0.25),transparent_68%)]"
		></div>
		<div
			class="pointer-events-none absolute -bottom-64 -left-48 size-[35rem] rounded-full bg-[radial-gradient(circle,rgba(85,115,176,0.25),transparent_68%)]"
		></div>
		<div
			class="absolute top-24 -right-8 size-44 bg-[radial-gradient(rgba(255,255,255,0.18)_1px,transparent_1px)] [mask-image:linear-gradient(to_bottom_left,black,transparent_75%)] bg-[length:15px_15px]"
			aria-hidden="true"
		></div>

		<div class="relative z-10 flex h-full flex-col p-[clamp(2rem,5vw,4.25rem)]">
			<BrandMark light />
			<div class="my-auto max-w-[34rem] py-16">
				<p
					class="mb-5 flex items-center gap-3 text-xs font-extrabold tracking-[0.12em] text-[#ffb09d] uppercase before:h-0.5 before:w-8 before:bg-[#ff795c] before:content-['']"
				>
					Your people, one place
				</p>
				<h2
					class="m-0 max-w-[32rem] text-[clamp(2.8rem,5.2vw,4.9rem)] leading-[0.99] font-bold tracking-[-0.065em]"
				>
					{story_title}
				</h2>
				<p class="mt-6 max-w-[29rem] text-[clamp(0.95rem,1.5vw,1.08rem)] leading-7 text-[#b8c1d5]">
					{story_body}
				</p>
			</div>
			<p class="m-0 text-xs font-semibold tracking-wide text-[#8995ae]">CONNECT · SHARE · BELONG</p>
		</div>
	</section>

	<section
		class="relative flex min-h-svh flex-col items-center justify-center overflow-y-auto px-6 py-24 max-[375px]:justify-start max-[375px]:px-4 max-[375px]:pt-16 max-[375px]:pb-2 lg:min-h-0 lg:px-[clamp(2rem,7vw,7rem)]"
	>
		<div class="absolute top-6 left-6 max-[375px]:top-4 max-[375px]:left-4 lg:hidden">
			<BrandMark />
		</div>
		{@render children()}
	</section>
</main>
