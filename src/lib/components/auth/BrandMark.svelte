<script lang="ts">
	import { resolve } from '$app/paths'

	let { light = false }: { light?: boolean } = $props()
</script>

<a
	href={resolve('/')}
	aria-label="Loop home"
	class="inline-flex items-center gap-3 no-underline {light ? 'text-white' : 'text-[#17233c]'}"
>
	<span
		class="relative grid size-[2.15rem] -rotate-6 place-items-center rounded-xl bg-[#ff6b4a] shadow-[0_8px_20px_rgba(255,107,74,0.28)]"
		aria-hidden="true"
	>
		<span class="absolute left-[0.48rem] size-[0.7rem] rounded-full border-2 border-white"></span>
		<span class="absolute right-[0.48rem] size-[0.7rem] rounded-full border-2 border-white"></span>
	</span>
	<span class="text-[1.45rem] font-extrabold tracking-[-0.055em]">loop</span>
</a>
