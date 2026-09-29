<script lang="ts">
	import AuthRouteShell from '$lib/components/auth/AuthRouteShell.svelte'
	import RegisterForm from '$lib/components/auth/RegisterForm.svelte'
</script>

<svelte:head>
	<title>Create an account · Loop</title>
	<meta name="description" content="Create your Loop account and join the conversation." />
</svelte:head>

<AuthRouteShell
	story_title="Find your people. Join the moment."
	story_body="Build your circle, share what matters, and make every conversation feel a little more human."
>
	<RegisterForm />
</AuthRouteShell>
