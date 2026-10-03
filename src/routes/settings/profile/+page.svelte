<script lang="ts">
	import { enhance } from '$app/forms'
	import { Button } from '$lib/components/ui/button'
	import { Input } from '$lib/components/ui/input'
	import { Label } from '$lib/components/ui/label'
	import { Separator } from '$lib/components/ui/separator'

	let { data, form } = $props()
	let saving = $state(false)
</script>

<div class="space-y-6">
	<div>
		<h3 class="text-lg font-medium">Profile Settings</h3>
		<p class="text-sm text-muted-foreground">
			Manage your public profile information.
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
		{#if form?.error}
			<p class="text-sm text-rose-600 bg-rose-50 p-3 rounded-md">{form.error}</p>
		{/if}

		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="name">Display Name</Label>
				<Input id="name" name="name" value={data.user.name} required />
			</div>

			<div class="space-y-2">
				<Label for="username">Username</Label>
				<div class="relative">
					<span class="absolute inset-y-0 left-3 flex items-center text-muted-foreground">@</span>
					<Input id="username" name="username" value={data.user.username} class="pl-7" />
				</div>
				<p class="text-[0.8rem] text-muted-foreground">
					Changing this will break existing links to your profile.
				</p>
			</div>

			<div class="space-y-2">
				<Label for="bio">Bio</Label>
				<textarea
					id="bio"
					name="bio"
					rows="3"
					class="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					value={data.user.bio}
				></textarea>
			</div>
		</div>

		<div class="flex items-center gap-4">
			<Button type="submit" disabled={saving}>
				{saving ? 'Saving...' : 'Save Profile'}
			</Button>
			{#if form?.success}
				<p class="text-sm text-green-600 dark:text-green-400">Profile saved successfully.</p>
			{/if}
		</div>
	</form>
</div>
