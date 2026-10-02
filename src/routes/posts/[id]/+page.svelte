<script lang="ts">
	import { resolve } from '$app/paths'
	import AppShell from '$lib/components/app/AppShell.svelte'
	import HomeSidebar from '$lib/components/app/HomeSidebar.svelte'
	import PostCard from '$lib/components/app/PostCard.svelte'

	let { data } = $props()
</script>

<AppShell user={data.user} title="Post">
	{#snippet right_sidebar()}
		<HomeSidebar
			suggested_users={data.suggested_users ?? []}
			trending_topics={data.trending_topics ?? []}
		/>
	{/snippet}

	<div class="w-full">
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
			initial_open_comments={true}
			on_deleted={() => {
				window.location.href = resolve('/')
			}}
		/>
	</div>
</AppShell>
