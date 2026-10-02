<script lang="ts">
	import { create_post } from '$lib/api/post.remote'
</script>

<h1>Create Post</h1>

<form {...create_post} enctype="multipart/form-data">
	<div>
		<label for="content">Content:</label>
		<textarea
			id="content"
			{...create_post.fields.content.as('text')}
			placeholder="What is on your mind?"></textarea>
		{#each create_post.fields.content.issues() as issue (issue.message)}
			<p class="error">{issue.message}</p>
		{/each}
	</div>

	<div>
		<label for="visibility">Visibility:</label>
		<select id="visibility" {...create_post.fields.visibility.as('select')}>
			<option value="public">Public</option>
			<option value="followers-only">Followers Only</option>
		</select>
		{#each create_post.fields.visibility.issues() as issue (issue.message)}
			<p class="error">{issue.message}</p>
		{/each}
	</div>

	<div>
		<label for="image">Image (optional):</label>
		<input
			id="image"
			{...create_post.fields.image.as('file')}
			accept="image/jpeg,image/png,image/webp,image/gif"
		/>
		{#each create_post.fields.image.issues() as issue (issue.message)}
			<p class="error">{issue.message}</p>
		{/each}
	</div>

	<button type="submit" disabled={Boolean(create_post.pending)}>
		{create_post.pending ? 'Submitting...' : 'Submit Post'}
	</button>
</form>

<style>
	.error {
		color: red;
		font-size: 0.875rem;
		margin: 0.25rem 0 0;
	}
</style>
