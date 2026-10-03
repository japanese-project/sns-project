<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import LogOutIcon from '@lucide/svelte/icons/log-out'
	import SettingsIcon from '@lucide/svelte/icons/settings'
	import { sign_out } from '$lib/auth-client'
	import { get_banner_class } from '$lib/banner-themes'
	import AppShell from '$lib/components/app/AppShell.svelte'
	import Avatar from '$lib/components/app/Avatar.svelte'
	import EditProfileModal from '$lib/components/app/EditProfileModal.svelte'
	import FollowButton from '$lib/components/app/FollowButton.svelte'
	import PostList from '$lib/components/app/PostList.svelte'
	import { parse_content } from '$lib/content'
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

	async function handle_sign_out() {
		await sign_out()
		await goto(resolve('/login'))
	}
</script>

<AppShell user={data.user} title={profile.is_self ? 'Profile' : profile.user.name}>
	<div class="mx-auto w-full max-w-2xl">
		<section class="border-b border-slate-200/60 px-2 pt-4 pb-6">
			<!-- Header Banner -->
			<div
				data-testid="profile-banner"
				class="mb-6 h-32 w-full rounded-2xl sm:h-44 {get_banner_class(
					profile.banner_color || profile.user.banner_color,
				)} shadow-inner"
			></div>

			<!-- Header Action Bar: Avatar + Actions (Responsive for Mobile & Desktop) -->
			<div class="flex items-center justify-between gap-4">
				<Avatar user={profile.user} size={80} />
				<div class="flex shrink-0 items-center gap-2">
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
							class="rounded-full bg-black px-4 py-2 text-xs font-bold text-white shadow-xs transition-all duration-150 hover:bg-slate-800 active:scale-95 sm:px-5"
						>
							Edit Profile
						</button>
						<a
							href={resolve('/settings')}
							aria-label="Settings"
							class="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 active:scale-95"
						>
							<SettingsIcon class="size-3.5" />
							<span class="hidden sm:inline">Settings</span>
						</a>
						<button
							type="button"
							onclick={handle_sign_out}
							aria-label="Sign out"
							class="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-all duration-150 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 active:scale-95"
						>
							<LogOutIcon class="size-3.5" />
							<span class="hidden sm:inline">Sign out</span>
						</button>
					{/if}
				</div>
			</div>

			<!-- User Details (Left-aligned across all screens without aggressive stacking) -->
			<div class="mt-3.5">
				<div class="flex flex-wrap items-center gap-2">
					<h2 class="text-xl font-bold text-slate-900 sm:text-2xl">{profile.user.name}</h2>
					{#if !profile.is_self && profile.is_followed_by}
						<span
							class="rounded bg-slate-100 px-2 py-0.5 text-[0.68rem] font-semibold text-slate-600"
						>
							Follows you
						</span>
					{/if}
				</div>
				<div class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
					{#if profile.user.username}
						<span class="font-medium text-slate-600">@{profile.user.username}</span>
						<span>·</span>
					{/if}
					<span>Joined {joined}</span>
				</div>

				{#if profile.bio}
					<p
						class="mt-2.5 text-sm leading-relaxed [overflow-wrap:anywhere] break-words whitespace-pre-wrap text-slate-700"
					>
						{#each parse_content(profile.bio) as segment, i (i)}
							{#if segment.type === 'tag'}
								<a
									href="{resolve('/explore')}?q={encodeURIComponent(segment.text)}"
									class="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
								>
									{segment.text}
								</a>
							{:else if segment.type === 'link'}
								<a
									href={segment.href}
									target="_blank"
									rel="noopener noreferrer"
									class="font-medium [overflow-wrap:anywhere] break-all text-indigo-600 hover:text-indigo-700 hover:underline"
								>
									{segment.text}
								</a>
							{:else}
								{segment.text}
							{/if}
						{/each}
					</p>
				{/if}

				{#if profile.interests && profile.interests.length > 0}
					<div class="mt-3 flex flex-wrap gap-x-3 gap-y-1">
						{#each profile.interests as interest (interest)}
							<a
								href="{resolve('/explore')}?q={encodeURIComponent('#' + interest)}"
								class="text-xs font-semibold text-slate-600 transition hover:text-slate-900 hover:underline"
							>
								#{interest}
							</a>
						{/each}
					</div>
				{:else if profile.is_self}
					<button
						type="button"
						onclick={() => (show_edit_modal = true)}
						class="mt-3 text-xs text-slate-400 transition hover:text-slate-900 hover:underline"
					>
						+ Add topics you enjoy
					</button>
				{/if}

				<dl class="mt-3.5 flex items-center gap-5">
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
						banner_color: updated.banner_color ?? profile.banner_color,
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
