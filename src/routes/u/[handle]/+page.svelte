<script lang="ts">
	import { resolve } from '$app/paths'
	import AppShell from '$lib/components/app/AppShell.svelte'
	import Avatar from '$lib/components/app/Avatar.svelte'
	import EditProfileModal from '$lib/components/app/EditProfileModal.svelte'
	import FollowButton from '$lib/components/app/FollowButton.svelte'
	import PostList from '$lib/components/app/PostList.svelte'
	import type { ProfileView } from '$lib/types'

	let { data } = $props()

	let profile_override = $state<ProfileView | null>(null)
	let profile = $derived(profile_override ?? data.profile)
	let follow_state = $state<{ following: boolean; follower_count: number } | null>(null)
	let following = $derived(follow_state?.following ?? profile.is_following)
	let follower_count = $derived(follow_state?.follower_count ?? profile.follower_count)
	let joined = $derived(
		new Date(profile.joined_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
	)
	let show_edit_modal = $state(false)
</script>

<AppShell user={data.user} title={profile.is_self ? 'Profile' : profile.user.name}>
	<div class="mx-auto w-full max-w-2xl">
		<section
			class="rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-xs sm:p-8"
		>
			<div class="flex justify-center"><Avatar user={profile.user} size={88} /></div>
			<h2 class="mt-4 text-xl font-bold text-slate-900 sm:text-2xl">{profile.user.name}</h2>
			<div class="mt-1 flex items-center justify-center gap-2">
				{#if profile.user.username}<p class="text-sm text-slate-500">
						@{profile.user.username}
					</p>{/if}
				{#if !profile.is_self && profile.is_followed_by}
					<span
						class="rounded bg-slate-100 px-2 py-0.5 text-[0.68rem] font-semibold text-slate-600"
					>
						Follows you
					</span>
				{/if}
			</div>
			<p class="mt-1 text-xs text-slate-400">Joined {joined}</p>

			{#if profile.bio}
				<p class="mx-auto mt-3 max-w-md text-sm whitespace-pre-wrap text-slate-700">
					{profile.bio}
				</p>
			{/if}

			{#if profile.interests && profile.interests.length > 0}
				<div class="mt-3 flex flex-wrap justify-center gap-1.5">
					{#each profile.interests as interest (interest)}
						<span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
							#{interest}
						</span>
					{/each}
				</div>
			{/if}

			<div class="mt-5 flex justify-center">
				{#if !profile.is_self}
					<FollowButton
						handle={profile.user.handle}
						{following}
						follows_you={Boolean(profile.is_followed_by)}
						signed_in={data.user !== null}
						on_change={(s) => (follow_state = s)}
					/>
				{:else}
					<button
						type="button"
						onclick={() => (show_edit_modal = true)}
						class="rounded-full bg-black px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800"
					>
						Edit Profile
					</button>
				{/if}
			</div>

			<dl class="mt-6 flex justify-center gap-10 border-t border-slate-100 pt-5">
				<a href={resolve('/u/[handle]/followers', { handle: profile.user.handle })} class="group">
					<dd
						class="text-lg font-bold text-slate-900 tabular-nums sm:text-xl"
						data-testid="follower-count"
					>
						{follower_count}
					</dd>
					<dt
						class="text-[11px] font-semibold tracking-wider text-slate-400 uppercase group-hover:text-slate-700"
					>
						Followers
					</dt>
				</a>
				<a href={resolve('/u/[handle]/following', { handle: profile.user.handle })} class="group">
					<dd class="text-lg font-bold text-slate-900 tabular-nums sm:text-xl">
						{profile.following_count}
					</dd>
					<dt
						class="text-[11px] font-semibold tracking-wider text-slate-400 uppercase group-hover:text-slate-700"
					>
						Following
					</dt>
				</a>
			</dl>
		</section>

		{#if show_edit_modal}
			<EditProfileModal
				user={profile.user}
				on_close={() => (show_edit_modal = false)}
				on_saved={(updated) => {
					profile_override = {
						...profile,
						user: { ...profile.user, ...updated },
						bio: updated.bio ?? null,
					}
				}}
			/>
		{/if}

		<h3 class="mt-8 mb-4 px-1 text-xs font-bold tracking-wider text-slate-500 uppercase">Posts</h3>
		{#key profile.user.id}
			<PostList
				endpoint="/api/users/{encodeURIComponent(profile.user.handle)}/posts"
				signed_in={data.user !== null}
				accepts_new_posts={profile.is_self && data.user !== null}
				empty_message={profile.is_self
					? "You haven't posted yet."
					: `${profile.user.name} has no posts you can see yet.`}
			/>
		{/key}
	</div>
</AppShell>
