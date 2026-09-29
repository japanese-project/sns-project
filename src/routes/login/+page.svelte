<script lang="ts">
	import { resolve } from '$app/paths'
	import BrandMark from '$lib/components/auth/BrandMark.svelte'
	import LoginForm from '$lib/components/auth/LoginForm.svelte'
</script>

<svelte:head>
	<title>Sign in · Loop</title>
	<meta
		name="description"
		content="Sign in to Loop and reconnect with the people and conversations that matter."
	/>
</svelte:head>

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
					class="m-0 max-w-[31rem] text-[clamp(2.8rem,5.4vw,5.15rem)] leading-[0.99] font-bold tracking-[-0.065em]"
				>
					Share the little things that make life big.
				</h2>
				<p class="mt-6 max-w-[29rem] text-[clamp(0.95rem,1.5vw,1.08rem)] leading-7 text-[#b8c1d5]">
					A calmer place to stay close, swap ideas, and celebrate everyday moments with the people
					who matter.
				</p>
			</div>

			<div
				class="flex w-fit items-center gap-4 rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 backdrop-blur-xl"
			>
				<div class="flex pl-1" aria-hidden="true">
					<span
						class="-ml-1 grid size-[2.15rem] place-items-center rounded-full border-2 border-[#263454] bg-[#d86f52] text-[0.66rem] font-extrabold text-white"
						>M</span
					>
					<span
						class="-ml-1 grid size-[2.15rem] place-items-center rounded-full border-2 border-[#263454] bg-[#5d8b9f] text-[0.66rem] font-extrabold text-white"
						>K</span
					>
					<span
						class="-ml-1 grid size-[2.15rem] place-items-center rounded-full border-2 border-[#263454] bg-[#826bac] text-[0.66rem] font-extrabold text-white"
						>J</span
					>
					<span
						class="-ml-1 grid size-[2.15rem] place-items-center rounded-full border-2 border-[#263454] bg-[#ca9952] text-[0.66rem] font-extrabold text-white"
						>A</span
					>
				</div>
				<div>
					<strong class="text-xs">Join the conversation</strong>
					<p class="mt-0.5 mb-0 text-[0.7rem] text-[#aeb8cc]">Good people are already waiting.</p>
				</div>
			</div>
		</div>
	</section>

	<section
		class="max-h-[760px]:lg:justify-start max-h-[760px]:lg:overflow-y-auto relative flex min-h-svh flex-col items-center justify-center px-6 pt-26 pb-20 max-[375px]:justify-start max-[375px]:px-4 max-[375px]:pt-14 max-[375px]:pb-4 lg:min-h-0 lg:px-[clamp(2rem,7vw,7rem)] lg:py-12"
	>
		<div class="absolute top-6 left-6 max-[375px]:top-4 max-[375px]:left-4 lg:hidden">
			<BrandMark />
		</div>
		<LoginForm />
		<p
			class="max-h-[760px]:lg:hidden absolute bottom-5 m-0 text-center text-[0.68rem] text-[#a0a7b5] max-[375px]:hidden"
		>
			By continuing, you agree to our
			<a
				class="font-semibold text-[#70798c] no-underline hover:underline"
				href={resolve('/login#terms')}>Terms</a
			>
			and
			<a
				class="font-semibold text-[#70798c] no-underline hover:underline"
				href={resolve('/login#privacy')}>Privacy Policy</a
			>.
		</p>
	</section>
</main>
