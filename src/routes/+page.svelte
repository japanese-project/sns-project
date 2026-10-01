<script lang="ts">
	import AppShell from '$lib/components/app/AppShell.svelte'
	import PostList from '$lib/components/app/PostList.svelte'

	let { data } = $props()
</script>

<AppShell user={data.user} title="Home">
	<PostList
		endpoint="/api/posts"
		signed_in={true}
		accepts_new_posts
		empty_message="No posts yet. Be the first to share something."
	/>
</AppShell>
