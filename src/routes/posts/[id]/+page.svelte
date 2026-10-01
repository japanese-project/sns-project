<script lang="ts">
	import { resolve } from '$app/paths'
	import AppShell from '$lib/components/app/AppShell.svelte'
	import PostCard from '$lib/components/app/PostCard.svelte'

	let { data } = $props()
</script>

<AppShell user={data.user} title="Post">
	<div class="mx-auto w-full max-w-2xl">
		<div class="mb-4">
			<a
				href={resolve('/')}
				class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-900"
			>
				← Back to feed
			</a>
		</div>

		<PostCard
			post={data.post}
			signed_in={data.user !== null}
			initial_open_comments={true}
			on_deleted={() => {
				window.location.href = resolve('/')
			}}
		/>
	</div>
</AppShell>
