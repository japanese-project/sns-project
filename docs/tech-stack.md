# Tech Stack

What we use and why.

## Application

- **SvelteKit + Cloudflare Workers** — app framework and deployment. Already wired up.
- **pnpm** — package manager. Already wired up.
- **Better Auth** — authentication with Google OAuth. Already wired up.
- **Relational database** — application data plus Better Auth user/account/session records. Cloudflare D1 + Drizzle. Already wired up.
- **Drizzle ORM** — database access and migrations. Already wired up.
- **Cloudflare KV** — **required** Better Auth secondary storage for sessions, verification, rate limits, and other short-lived key-value data. Already wired up.
- **Object storage** — uploaded post images. Planned; likely [Cloudflare R2](https://developers.cloudflare.com/r2/), but the service is not yet decided.
- **svelte-i18n** — localization (en/ja/km). Message dictionaries in `src/lib/locales/*.json`, wired up in `src/lib/i18n/`. Already wired up.

## Quality and tooling

- **ESLint** — linting; enforces `snake_case` for variables and functions. Already wired up.
- **Prettier** — formatting. Already wired up.
- **CSpell** — spell-checking source and docs. Planned.
- **Vitest + Playwright** — unit and end-to-end tests. Already wired up.
- **Lefthook** — Git hooks for pre-commit auto-fix and pre-push checks. Already wired up.
- **`pnpm audit`** — dependency vulnerability check on pre-push. Already wired up in `lefthook.yml`.
- **safe-chain** — blocks malicious packages on install. Planned.
- **GitHub Actions** — CI for lint, test, and build. Already wired up in `.github/workflows/ci.yml`.
- **CodeRabbit** — AI PR review. Planned.
- **SonarCloud** — code quality and security scanning. Planned.

## Auth and storage roles

Better Auth is the authentication layer. The core auth _tables_ (`user`, `account`, `session`, `verification`) live in the relational database and remain the source of truth for identity — `session`/`verification` rows exist there for referential integrity and as the durable record. Cloudflare KV is required as Better Auth's **secondary storage**: session/verification/rate-limit reads and writes go through KV first per the auth configuration.

The roles are intentionally separate:

- **Relational DB:** source of truth for application entities — users/auth records plus posts, likes, comments, follows, and notifications.
- **Cloudflare KV:** required secondary key-value storage for short-lived/high-frequency auth data (sessions, verification, rate limits). It is not the source of truth for social graph or post data.
- **Object storage:** binary post images only.
- **Better Auth:** owns authentication/session behavior; application authorization (for example public vs followers-only posts) remains an application rule and must be enforced by the API/backend.

Cloudflare KV must be wired into Better Auth's `secondaryStorage` configuration before Phase 1 is marked complete.

## Code style

Variables and functions are `snake_case`, enforced by ESLint (`eslint.config.js`). Lefthook auto-fixes staged TypeScript files on pre-commit; Prettier is checked on pre-push.

## Localization

User-facing copy lives in `src/lib/locales/{en,ja,km}.json`, keyed by nested paths (`nav.home`, `post.copy_link`). Components read it through the `$t` store exported by `src/lib/i18n`:

```svelte
<script lang="ts">
	import { t } from '$lib/i18n'
</script>

<button aria-label={$t('post.copy_link')}>{$t('nav.home')}</button>
```

Rules that keep this working:

- **Call `$t` directly in the template, never a wrapper function.** The store subscription is what re-renders the component on a language change; reading the store through `get()` or a helper drops that dependency and the text goes stale.
- **Pass interpolation values under `values`:** `{$t('post.characters_left', { values: { count: 12 } })}`.
- **Locale codes must be valid BCP-47 language tags** — `ja` and `km`, not the country codes `jp` and `kh`. `Intl` silently falls back to English for the latter, so dates and numbers would render in the wrong language while the UI claimed otherwise.
- **`en.json` is registered with `addMessages`, the other locales with `register`.** English is the fallback, so it must be available synchronously; a loader would resolve `$t()` to raw keys until its flush completed, which breaks both SSR and the component tests.
- **`init_i18n` runs in the root layout load, not in the component tree.** Awaiting it in a load function is what keeps SSR and hydration in the same language; wrapping the app in `{#await waitLocale()}` renders the pending branch on the server.
- **The language is detected, not persisted.** It comes from `Accept-Language` on the server (see `negotiate_locale`) and `navigator.language` on the client. A hard refresh resets it to the browser's preference. Adding a `locale` cookie would mean writing it in `set_locale` and reading it in `hooks.server.ts` before negotiation.

Timestamps go through `<RelativeTime>`, which buckets the delta (`src/lib/time.ts`) and lets the dictionary choose the wording, so `5m ago` becomes `5分前`. Absolute dates use `$date`, which is locale-aware via `Intl`.
