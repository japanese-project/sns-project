<script lang="ts">
	import AuthRouteShell from '$lib/components/auth/AuthRouteShell.svelte'
	import ForgotPasswordForm from '$lib/components/auth/ForgotPasswordForm.svelte'
</script>

<svelte:head>
	<title>Reset password · Loop</title>
	<meta name="description" content="Reset the password for your Loop account." />
</svelte:head>

<AuthRouteShell
	story_title="Your circle is still right here."
	story_body="Reset your password securely and get back to the people, ideas, and moments you care about."
>
	<ForgotPasswordForm />
</AuthRouteShell>
