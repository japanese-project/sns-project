<script lang="ts">
	import { enhance } from '$app/forms'
	import { Button } from '$lib/components/ui/button'
	import { Checkbox } from '$lib/components/ui/checkbox'
	import { Label } from '$lib/components/ui/label'
	import { Separator } from '$lib/components/ui/separator'

	let { data, form } = $props()
	let saving = $state(false)
</script>

<div class="space-y-6">
	<div>
		<h3 class="text-lg font-medium">Privacy & Safety</h3>
		<p class="text-sm text-muted-foreground">
			Manage who can see your content and how you get notified.
		</p>
	</div>
	<Separator />
	
	<form
		method="POST"
		class="space-y-8"
		use:enhance={() => {
			saving = true
			return async ({ update }) => {
				await update()
				saving = false
			}
		}}
	>
		<div class="space-y-4">
			<h4 class="text-sm font-medium">Account Privacy</h4>
			<div class="flex items-start space-x-3">
				<Checkbox id="isPrivate" name="is_private" checked={data.settings.isPrivate} />
				<div class="space-y-1 leading-none">
					<Label for="isPrivate">Private Account</Label>
					<p class="text-sm text-muted-foreground">
						When your account is private, only people you approve can see your posts and followers.
					</p>
				</div>
			</div>
		</div>

		<Separator />

		<div class="space-y-4">
			<h4 class="text-sm font-medium">Notifications</h4>
			<div class="flex items-start space-x-3">
				<Checkbox id="notifyOnFollow" name="notify_on_follow" checked={data.settings.notifyOnFollow} />
				<div class="space-y-1 leading-none">
					<Label for="notifyOnFollow">New Followers</Label>
					<p class="text-sm text-muted-foreground">
						Receive a notification when someone follows you.
					</p>
				</div>
			</div>
			
			<div class="flex items-start space-x-3">
				<Checkbox id="notifyOnLike" name="notify_on_like" checked={data.settings.notifyOnLike} />
				<div class="space-y-1 leading-none">
					<Label for="notifyOnLike">Likes</Label>
					<p class="text-sm text-muted-foreground">
						Receive a notification when someone likes your post.
					</p>
				</div>
			</div>

			<div class="flex items-start space-x-3">
				<Checkbox id="notifyOnComment" name="notify_on_comment" checked={data.settings.notifyOnComment} />
				<div class="space-y-1 leading-none">
					<Label for="notifyOnComment">Comments</Label>
					<p class="text-sm text-muted-foreground">
						Receive a notification when someone comments on your post.
					</p>
				</div>
			</div>
		</div>

		<div class="flex items-center gap-4">
			<Button type="submit" disabled={saving}>
				{saving ? 'Saving...' : 'Save preferences'}
			</Button>
			{#if form?.success}
				<p class="text-sm text-green-600 dark:text-green-400">Settings saved successfully.</p>
			{/if}
		</div>
	</form>
</div>
