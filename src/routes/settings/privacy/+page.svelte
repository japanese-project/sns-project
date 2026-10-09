<script lang="ts">
	import { enhance } from '$app/forms'
	import { Button } from '$lib/components/ui/button'
	import { Checkbox } from '$lib/components/ui/checkbox'
	import { Label } from '$lib/components/ui/label'
	import { Separator } from '$lib/components/ui/separator'
	import { t } from '$lib/i18n'

	let { data, form } = $props()
	let saving = $state(false)
</script>

<div class="space-y-6">
	<div>
		<h3 class="text-lg font-medium">{$t('settings.privacy_title')}</h3>
		<p class="text-sm text-muted-foreground">{$t('settings.privacy_desc')}</p>
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
			<h4 class="text-sm font-medium">{$t('settings.account_privacy')}</h4>
			<div class="flex items-start space-x-3">
				<Checkbox id="isPrivate" name="is_private" checked={data.settings.isPrivate} />
				<div class="space-y-1 leading-none">
					<Label for="isPrivate">{$t('settings.private_account')}</Label>
					<p class="text-sm text-muted-foreground">
						{$t('settings.private_account_desc')}
					</p>
				</div>
			</div>
		</div>

		<Separator />

		<div class="space-y-4">
			<h4 class="text-sm font-medium">{$t('settings.notifications')}</h4>
			<div class="flex items-start space-x-3">
				<Checkbox
					id="notifyOnFollow"
					name="notify_on_follow"
					checked={data.settings.notifyOnFollow}
				/>
				<div class="space-y-1 leading-none">
					<Label for="notifyOnFollow">{$t('settings.new_followers')}</Label>
					<p class="text-sm text-muted-foreground">
						{$t('settings.new_followers_desc')}
					</p>
				</div>
			</div>

			<div class="flex items-start space-x-3">
				<Checkbox id="notifyOnLike" name="notify_on_like" checked={data.settings.notifyOnLike} />
				<div class="space-y-1 leading-none">
					<Label for="notifyOnLike">{$t('settings.new_likes')}</Label>
					<p class="text-sm text-muted-foreground">
						{$t('settings.new_likes_desc')}
					</p>
				</div>
			</div>

			<div class="flex items-start space-x-3">
				<Checkbox
					id="notifyOnComment"
					name="notify_on_comment"
					checked={data.settings.notifyOnComment}
				/>
				<div class="space-y-1 leading-none">
					<Label for="notifyOnComment">{$t('settings.new_comments')}</Label>
					<p class="text-sm text-muted-foreground">
						{$t('settings.new_comments_desc')}
					</p>
				</div>
			</div>
		</div>

		<div class="flex items-center gap-4">
			<Button type="submit" disabled={saving}>
				{saving ? $t('common.saving') : $t('common.save')}
			</Button>
			{#if form?.success}
				<p class="text-sm text-green-600 dark:text-green-400">{$t('settings.saved')}</p>
			{/if}
		</div>
	</form>
</div>
