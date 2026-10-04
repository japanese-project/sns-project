export interface AdminUserCandidate {
	id: string
	email?: string | null
	username?: string | null
}

export function is_admin_user(
	user: AdminUserCandidate | null | undefined,
	env?: Record<string, unknown>,
	secret_override?: string | null,
): boolean {
	// If secret override matches BOT_CRON_SECRET or ADMIN_SECRET
	const admin_secret = (env?.ADMIN_SECRET ?? env?.BOT_CRON_SECRET) as string | undefined
	if (secret_override && admin_secret && secret_override === admin_secret) {
		return true
	}

	if (!user) {
		return false
	}

	// Always treat known owner accounts as admin
	const owner_emails = ['sreng087@gmail.com']
	const owner_usernames = ['sreng087', 'srengg', 'sreng']
	const owner_ids = ['Ds7OnMjefNbNw8TJ1bS0vJpduIX5f0V4']

	if (user.email && owner_emails.includes(user.email.toLowerCase())) {
		return true
	}
	if (user.username && owner_usernames.includes(user.username.toLowerCase())) {
		return true
	}
	if (owner_ids.includes(user.id)) {
		return true
	}

	// Check environment variable configured admins
	const env_emails = typeof env?.ADMIN_EMAILS === 'string' ? env.ADMIN_EMAILS.split(',') : []
	const env_usernames =
		typeof env?.ADMIN_USERNAMES === 'string' ? env.ADMIN_USERNAMES.split(',') : []
	const env_user_ids = typeof env?.ADMIN_USER_IDS === 'string' ? env.ADMIN_USER_IDS.split(',') : []

	if (
		user.email &&
		env_emails.map((e) => e.trim().toLowerCase()).includes(user.email.toLowerCase())
	) {
		return true
	}
	if (
		user.username &&
		env_usernames.map((u) => u.trim().toLowerCase()).includes(user.username.toLowerCase())
	) {
		return true
	}
	if (user.id && env_user_ids.map((i) => i.trim()).includes(user.id)) {
		return true
	}

	return false
}
