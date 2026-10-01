<script lang="ts">
	import { resolve } from '$app/paths'
	import AppShell from '$lib/components/app/AppShell.svelte'
	import Avatar from '$lib/components/app/Avatar.svelte'
	import FollowButton from '$lib/components/app/FollowButton.svelte'
	import PostList from '$lib/components/app/PostList.svelte'

	let { data } = $props()

	let follow_state = $state<{ following: boolean; follower_count: number } | null>(null)
	let profile = $derived(data.profile)
	let following = $derived(follow_state?.following ?? profile.is_following)
	let follower_count = $derived(follow_state?.follower_count ?? profile.follower_count)
	let joined = $derived(
		new Date(profile.joined_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
	)
</script>

<AppShell user={data.user} title={profile.is_self ? 'Profile' : profile.user.name}>
	<section class="rounded-[2.5rem] bg-white/80 p-8 text-center shadow-sm ring-1 ring-slate-200/70">
		<div class="flex justify-center"><Avatar user={profile.user} size={96} /></div>
		<h2 class="mt-4 text-2xl font-bold text-slate-900">{profile.user.name}</h2>
		{#if profile.user.username}<p class="text-slate-500">@{profile.user.username}</p>{/if}
		<p class="mt-1 text-sm text-slate-400">Joined {joined}</p>

		<div class="mt-5 flex justify-center">
			{#if !profile.is_self}
				<FollowButton
					handle={profile.user.handle}
					{following}
					signed_in={data.user !== null}
					on_change={(s) => (follow_state = s)}
				/>
			{/if}
		</div>

		<dl class="mt-6 flex justify-center gap-10 border-t border-slate-200 pt-5">
			<a href={resolve('/u/[handle]/followers', { handle: profile.user.handle })} class="group">
				<dd class="text-xl font-semibold text-slate-900 tabular-nums" data-testid="follower-count">
					{follower_count}
				</dd>
				<dt class="text-xs tracking-widest text-slate-400 uppercase group-hover:text-slate-700">
					Followers
				</dt>
			</a>
			<a href={resolve('/u/[handle]/following', { handle: profile.user.handle })} class="group">
				<dd class="text-xl font-semibold text-slate-900 tabular-nums">{profile.following_count}</dd>
				<dt class="text-xs tracking-widest text-slate-400 uppercase group-hover:text-slate-700">
					Following
				</dt>
			</a>
		</dl>
	</section>

	<h3 class="mt-10 mb-4 px-2 text-xs font-semibold tracking-widest text-slate-400 uppercase">
		Posts
	</h3>
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
</AppShell>
