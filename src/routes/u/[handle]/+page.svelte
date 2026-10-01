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
		<section class="border-b border-slate-200/60 px-2 pt-4 pb-6">
			<div class="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
				<!-- Left: Avatar & Info -->
				<div
					class="flex min-w-0 flex-1 flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:gap-6 sm:text-left"
				>
					<Avatar user={profile.user} size={88} />
					<div class="min-w-0 flex-1">
						<div class="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
							<h2 class="text-xl font-bold text-slate-900 sm:text-2xl">{profile.user.name}</h2>
							{#if !profile.is_self && profile.is_followed_by}
								<span
									class="rounded bg-slate-100 px-2 py-0.5 text-[0.68rem] font-semibold text-slate-600"
								>
									Follows you
								</span>
							{/if}
						</div>
						{#if profile.user.username}
							<p class="text-sm text-slate-500">@{profile.user.username}</p>
						{/if}
						<p class="mt-1 text-xs text-slate-400">Joined {joined}</p>

						{#if profile.bio}
							<p class="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
								{profile.bio}
							</p>
						{/if}

						{#if profile.interests && profile.interests.length > 0}
							<div class="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 sm:justify-start">
								{#each profile.interests as interest (interest)}
									<a
										href="{resolve('/explore')}?q={encodeURIComponent('#' + interest)}"
										class="text-sm text-slate-500 transition hover:text-slate-800 hover:underline"
									>
										#{interest}
									</a>
								{/each}
							</div>
						{:else if profile.is_self}
							<button
								type="button"
								onclick={() => (show_edit_modal = true)}
								class="mt-3 text-xs text-slate-400 transition hover:text-indigo-600 hover:underline"
							>
								+ Add topics you enjoy
							</button>
						{/if}

						<dl class="mt-4 flex items-center justify-center gap-6 sm:justify-start">
							<a
								href={resolve('/u/[handle]/followers', { handle: profile.user.handle })}
								class="group flex items-baseline gap-1.5"
							>
								<dd
									class="text-base font-bold text-slate-900 tabular-nums sm:text-lg"
									data-testid="follower-count"
								>
									{follower_count}
								</dd>
								<dt
									class="text-xs font-medium text-slate-500 group-hover:text-slate-900 group-hover:underline"
								>
									Followers
								</dt>
							</a>
							<a
								href={resolve('/u/[handle]/following', { handle: profile.user.handle })}
								class="group flex items-baseline gap-1.5"
							>
								<dd class="text-base font-bold text-slate-900 tabular-nums sm:text-lg">
									{profile.following_count}
								</dd>
								<dt
									class="text-xs font-medium text-slate-500 group-hover:text-slate-900 group-hover:underline"
								>
									Following
								</dt>
							</a>
						</dl>
					</div>
				</div>

				<!-- Right: Action Button -->
				<div class="shrink-0 self-center sm:self-start">
					{#if !profile.is_self}
						<FollowButton
							handle={profile.user.handle}
							{following}
							follows_you={Boolean(profile.is_followed_by)}
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
			</div>
		</section>

		{#if show_edit_modal}
			<EditProfileModal
				user={profile.user}
				current_interests={profile.interests}
				on_close={() => (show_edit_modal = false)}
				on_saved={(updated) => {
					profile_override = {
						...profile,
						user: { ...profile.user, ...updated },
						bio: updated.bio ?? null,
						interests: updated.interests ?? profile.interests,
					}
				}}
			/>
		{/if}

		<h3 class="mt-8 mb-4 px-1 text-xs font-bold tracking-wider text-slate-500 uppercase">Posts</h3>
		{#key profile.user.id}
			<PostList
				endpoint="/api/users/{encodeURIComponent(profile.user.handle)}/posts"
				accepts_new_posts={profile.is_self}
				empty_message={profile.is_self
					? "You haven't posted yet."
					: `${profile.user.name} has no posts you can see yet.`}
			/>
		{/key}
	</div>
</AppShell>
