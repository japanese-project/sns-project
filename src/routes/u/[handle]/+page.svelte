<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import BookmarkIcon from '@lucide/svelte/icons/bookmark'
	import CheckIcon from '@lucide/svelte/icons/check'
	import Grid3x3Icon from '@lucide/svelte/icons/grid-3x3'
	import HeartIcon from '@lucide/svelte/icons/heart'
	import LockIcon from '@lucide/svelte/icons/lock'
	import LogOutIcon from '@lucide/svelte/icons/log-out'
	import PaletteIcon from '@lucide/svelte/icons/palette'
	import SettingsIcon from '@lucide/svelte/icons/settings'
	import XIcon from '@lucide/svelte/icons/x'
	import { api } from '$lib/api'
	import { sign_out } from '$lib/auth-client'
	import { BANNER_THEMES, get_banner_class } from '$lib/banner-themes'
	import AppShell from '$lib/components/app/AppShell.svelte'
	import Avatar from '$lib/components/app/Avatar.svelte'
	import ConfirmDialog from '$lib/components/app/ConfirmDialog.svelte'
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
	let show_banner_modal = $state(false)
	let saving_banner = $state(false)
	let banner_error = $state<string | null>(null)

	// TikTok-style Tabs: 'posts' | 'favorites' | 'liked'
	let active_tab = $state<'posts' | 'favorites' | 'liked'>('posts')

	let show_sign_out_confirm = $state(false)
	let signing_out = $state(false)

	function handle_sign_out() {
		show_sign_out_confirm = true
	}

	async function confirm_sign_out() {
		if (signing_out) return
		signing_out = true
		try {
			await sign_out()
			show_sign_out_confirm = false
			await goto(resolve('/login'))
		} finally {
			signing_out = false
		}
	}

	async function select_banner(theme_id: string) {
		if (saving_banner) return
		saving_banner = true
		banner_error = null
		const next_theme = theme_id === 'default' ? null : theme_id
		try {
			await api('/api/users/me', {
				method: 'PATCH',
				body: { banner_color: next_theme },
			})
			profile_override = {
				...profile,
				banner_color: next_theme,
				user: {
					...profile.user,
					banner_color: next_theme,
				},
			}
			show_banner_modal = false
		} catch (e) {
			banner_error = e instanceof Error ? e.message : 'Failed to update banner'
		} finally {
			saving_banner = false
		}
	}
</script>

<AppShell user={data.user} title={profile.is_self ? 'Profile' : profile.user.name}>
	<div class="mx-auto w-full max-w-2xl">
		<!-- TikTok Style Profile Header Section -->
		<section class="border-b border-slate-200/60 pb-2 dark:border-slate-800">
			<!-- Header Banner with quick Change Banner trigger -->
			<div class="relative">
				<div
					data-testid="profile-banner"
					class="h-36 w-full rounded-3xl transition-all duration-300 sm:h-48 md:h-52 {get_banner_class(
						profile.banner_color || profile.user.banner_color,
					)} shadow-inner"
				></div>

				{#if profile.is_self}
					<button
						type="button"
						onclick={() => (show_banner_modal = true)}
						aria-label="Change banner theme"
						class="absolute right-3.5 bottom-3.5 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white shadow-md backdrop-blur-md transition-all hover:scale-105 hover:bg-black/80 active:scale-95 sm:px-3.5"
					>
						<PaletteIcon class="size-3.5" />
						<span class="text-xs">Change cover</span>
					</button>
				{/if}
			</div>

			<!-- Header Action Bar: Avatar + Actions (Responsive for Mobile & Desktop) -->
			<!-- Notice: preserves the flex items-center justify-between container required by layout tests -->
			<div class="relative -mt-10 flex items-center justify-between gap-4 px-3 sm:-mt-12 sm:px-4">
				<div class="relative rounded-full shadow-md ring-4 ring-white">
					<Avatar user={profile.user} size={80} />
				</div>

				<div class="mt-8 flex shrink-0 items-center gap-2 sm:mt-10">
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
							class="rounded-xl border border-slate-300/80 bg-white px-4 py-2 text-xs font-bold text-slate-800 shadow-2xs transition-all duration-150 hover:bg-slate-50 active:scale-95 sm:px-5 sm:text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
						>
							Edit Profile
						</button>
						<button
							type="button"
							onclick={() => (show_banner_modal = true)}
							title="Change Banner"
							aria-label="Change Banner"
							class="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
						>
							<PaletteIcon class="size-4" />
						</button>
						<a
							href={resolve('/settings')}
							aria-label="Settings"
							class="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
						>
							<SettingsIcon class="size-4" />
						</a>
						<button
							type="button"
							onclick={handle_sign_out}
							aria-label="Sign out"
							class="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition-all duration-150 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-rose-900 dark:hover:bg-rose-950 dark:hover:text-rose-400"
						>
							<LogOutIcon class="size-3.5" />
							<span class="hidden sm:inline">Sign out</span>
						</button>
					{/if}
				</div>
			</div>

			<!-- User Details (Left-aligned across all screens) -->
			<div class="mt-3 px-3 sm:px-4">
				<div class="flex flex-wrap items-center gap-2">
					<h2
						class="text-xl font-black tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100"
					>
						{profile.user.name}
					</h2>
					{#if !profile.is_self && profile.is_followed_by}
						<span
							class="rounded-md bg-slate-100 px-2 py-0.5 text-[0.68rem] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
						>
							Follows you
						</span>
					{/if}
				</div>
				<div
					class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400"
				>
					{#if profile.user.username}
						<span class="font-semibold text-slate-600 dark:text-slate-300"
							>@{profile.user.username}</span
						>
						<span>·</span>
					{/if}
					<span>Joined {joined}</span>
				</div>

				<!-- TikTok's Signature 3-Stats Row: Following, Followers, Likes -->
				<dl class="my-4 flex items-center gap-6 sm:gap-8">
					<a
						href={resolve('/u/[handle]/following', { handle: profile.user.handle })}
						class="group flex items-baseline gap-1.5 transition"
					>
						<dd
							class="text-base font-black text-slate-900 tabular-nums sm:text-lg dark:text-slate-100"
						>
							{profile.following_count}
						</dd>
						<dt
							class="text-xs font-medium text-slate-500 group-hover:text-slate-900 group-hover:underline dark:text-slate-400 dark:group-hover:text-slate-100"
						>
							Following
						</dt>
					</a>
					<a
						href={resolve('/u/[handle]/followers', { handle: profile.user.handle })}
						class="group flex items-baseline gap-1.5 transition"
					>
						<dd
							class="text-base font-black text-slate-900 tabular-nums sm:text-lg dark:text-slate-100"
							data-testid="follower-count"
						>
							{follower_count}
						</dd>
						<dt
							class="text-xs font-medium text-slate-500 group-hover:text-slate-900 group-hover:underline dark:text-slate-400 dark:group-hover:text-slate-100"
						>
							Followers
						</dt>
					</a>
					<div class="flex items-baseline gap-1.5">
						<dd
							class="text-base font-black text-slate-900 tabular-nums sm:text-lg dark:text-slate-100"
						>
							{profile.likes_count ?? 0}
						</dd>
						<dt class="text-xs font-medium text-slate-500 dark:text-slate-400">Likes</dt>
					</div>
				</dl>

				<!-- Bio Section -->
				{#if profile.bio}
					<p
						class="text-sm leading-relaxed [overflow-wrap:anywhere] break-words whitespace-pre-wrap text-slate-700 dark:text-slate-300"
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

				<!-- Interest Tags -->
				{#if profile.interests && profile.interests.length > 0}
					<div class="mt-3 flex flex-wrap gap-1.5">
						{#each profile.interests as interest (interest)}
							<a
								href="{resolve('/explore')}?q={encodeURIComponent('#' + interest)}"
								class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100"
							>
								#{interest}
							</a>
						{/each}
					</div>
				{:else if profile.is_self}
					<button
						type="button"
						onclick={() => (show_edit_modal = true)}
						class="mt-2.5 text-xs font-medium text-slate-400 transition hover:text-slate-900 hover:underline dark:text-slate-500 dark:hover:text-slate-100"
					>
						+ Add topics you enjoy
					</button>
				{/if}
			</div>

			<!-- TikTok Style Profile Content Tabs -->
			<div class="mt-6 flex border-b border-slate-200/80 px-2 sm:px-4 dark:border-slate-800">
				<button
					type="button"
					role="tab"
					aria-selected={active_tab === 'posts'}
					onclick={() => (active_tab = 'posts')}
					class="relative flex flex-1 items-center justify-center gap-2 py-3 text-xs font-bold tracking-wide transition sm:flex-initial sm:px-6 {active_tab ===
					'posts'
						? 'text-slate-900 dark:text-slate-100'
						: 'text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}"
				>
					<Grid3x3Icon class="size-4" />
					<span>Posts</span>
					{#if active_tab === 'posts'}
						<div
							class="absolute bottom-0 h-0.5 w-full bg-slate-900 sm:w-16 dark:bg-slate-100"
						></div>
					{/if}
				</button>

				<button
					type="button"
					role="tab"
					aria-selected={active_tab === 'favorites'}
					onclick={() => (active_tab = 'favorites')}
					class="relative flex flex-1 items-center justify-center gap-2 py-3 text-xs font-bold tracking-wide transition sm:flex-initial sm:px-6 {active_tab ===
					'favorites'
						? 'text-slate-900 dark:text-slate-100'
						: 'text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}"
				>
					<BookmarkIcon class="size-4" />
					<span>Favorites</span>
					{#if active_tab === 'favorites'}
						<div
							class="absolute bottom-0 h-0.5 w-full bg-slate-900 sm:w-16 dark:bg-slate-100"
						></div>
					{/if}
				</button>

				<button
					type="button"
					role="tab"
					aria-selected={active_tab === 'liked'}
					onclick={() => (active_tab = 'liked')}
					class="relative flex flex-1 items-center justify-center gap-2 py-3 text-xs font-bold tracking-wide transition sm:flex-initial sm:px-6 {active_tab ===
					'liked'
						? 'text-slate-900 dark:text-slate-100'
						: 'text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}"
				>
					<HeartIcon class="size-4" />
					<span>Liked</span>
					{#if active_tab === 'liked'}
						<div
							class="absolute bottom-0 h-0.5 w-full bg-slate-900 sm:w-16 dark:bg-slate-100"
						></div>
					{/if}
				</button>
			</div>
		</section>

		<!-- Tab Content Area -->
		<div class="mt-4 px-1">
			{#if active_tab === 'posts'}
				{#key profile.user.id}
					<PostList
						endpoint="/api/users/{encodeURIComponent(profile.user.handle)}/posts"
						accepts_new_posts={profile.is_self}
						empty_message={profile.is_self
							? "You haven't posted yet."
							: `${profile.user.name} has no posts you can see yet.`}
					/>
				{/key}
			{:else if profile.is_self}
				<!-- Favorites and likes are private, so these lists only ever exist for your own profile. -->
				{#if active_tab === 'favorites'}
					<PostList
						endpoint="/api/users/me/bookmarks"
						empty_message="No favorites yet. Tap the bookmark on any post to save it here."
					/>
				{:else}
					<PostList
						endpoint="/api/users/me/likes"
						empty_message="Posts you like will show up here."
					/>
				{/if}
			{:else}
				<div
					class="flex flex-col items-center justify-center py-16 text-center text-slate-500 dark:text-slate-400"
				>
					<div
						class="mb-3 rounded-full bg-slate-100 p-4 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
					>
						<LockIcon class="size-8" />
					</div>
					<h4 class="text-sm font-bold text-slate-800 dark:text-slate-200">
						{active_tab === 'favorites' ? 'Favorites are private' : 'Liked posts are private'}
					</h4>
					<p class="mt-1 max-w-xs text-xs text-slate-400 dark:text-slate-500">
						Only {profile.user.name} can see the posts they {active_tab === 'favorites'
							? 'saved'
							: 'liked'}.
					</p>
				</div>
			{/if}
		</div>

		<!-- Direct Change Banner Modal / Drawer -->
		{#if show_banner_modal}
			<div
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
				role="dialog"
				aria-modal="true"
				aria-labelledby="banner-modal-title"
			>
				<div
					class="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
				>
					<div class="flex items-center justify-between pb-3">
						<div class="flex items-center gap-2">
							<PaletteIcon class="size-4 text-indigo-600" />
							<h3
								id="banner-modal-title"
								class="text-base font-bold text-slate-900 dark:text-slate-100"
							>
								Choose Banner Cover
							</h3>
						</div>
						<button
							type="button"
							onclick={() => (show_banner_modal = false)}
							class="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
							aria-label="Close"
						>
							<XIcon class="size-4" />
						</button>
					</div>

					<p class="text-xs text-slate-500 dark:text-slate-400">
						Select a gradient style to personalize your TikTok profile header.
					</p>

					{#if banner_error}
						<p
							class="mt-3 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300"
						>
							{banner_error}
						</p>
					{/if}

					<div class="mt-4 grid grid-cols-2 gap-2.5">
						{#each BANNER_THEMES as theme (theme.id)}
							{@const is_active = (profile.banner_color || 'default') === theme.id}
							<button
								type="button"
								onclick={() => select_banner(theme.id)}
								disabled={saving_banner}
								class="group relative flex h-14 items-center justify-between overflow-hidden rounded-2xl border-2 px-3.5 transition-all {is_active
									? 'border-indigo-600 shadow-xs ring-2 ring-indigo-500/20'
									: 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'}"
							>
								<!-- Background gradient preview -->
								<div class="absolute inset-0 opacity-80 {theme.preview_class}"></div>
								<div class="absolute inset-0 bg-black/15 transition group-hover:bg-black/10"></div>

								<span class="relative z-10 text-xs font-bold text-white drop-shadow-xs">
									{theme.name}
								</span>

								{#if is_active}
									<div
										class="relative z-10 flex size-5 items-center justify-center rounded-full bg-white text-indigo-600 shadow-xs dark:bg-slate-800"
									>
										<CheckIcon class="size-3" />
									</div>
								{/if}
							</button>
						{/each}
					</div>

					<div class="mt-6 flex justify-end">
						<button
							type="button"
							onclick={() => (show_banner_modal = false)}
							class="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
						>
							Close
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Sign out confirmation -->
		{#if show_sign_out_confirm}
			<ConfirmDialog
				title="Sign out?"
				message="You'll need to sign in again to access your account."
				confirm_label="Sign out"
				danger
				busy={signing_out}
				on_confirm={confirm_sign_out}
				on_cancel={() => (show_sign_out_confirm = false)}
			/>
		{/if}

		<!-- Full Profile Edit Modal -->
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
	</div>
</AppShell>
