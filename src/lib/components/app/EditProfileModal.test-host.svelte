<script lang="ts">
	// Test-only host. It wires EditProfileModal the same way src/routes/u/[handle]/+page.svelte
	// does: the modal's `user` prop is read from state that `on_saved` then overwrites, so by the
	// time the modal finishes saving, `user` already reflects the new username.
	import type { UserSummary } from '$lib/types'
	import EditProfileModal from './EditProfileModal.svelte'

	let profile = $state<{ user: UserSummary & { bio?: string | null } }>({
		user: {
			id: 'user-1',
			name: 'Old Name',
			username: 'oldname',
			handle: 'oldname',
			image: null,
			bio: null,
		},
	})
	let open = $state(true)
</script>

{#if open}
	<EditProfileModal
		user={profile.user}
		on_close={() => (open = false)}
		on_saved={(updated) => {
			profile = { user: { ...profile.user, ...updated } }
		}}
	/>
{/if}
