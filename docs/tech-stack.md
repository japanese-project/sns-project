# Tech Stack

What we use and why.

## Application

- **SvelteKit + Cloudflare Workers** — app framework and deployment. Already wired up.
- **pnpm** — package manager. Already wired up.
- **Better Auth** — authentication with Google OAuth. Planned; `better-auth` is installed, but auth is not yet configured.
- **Relational database** — application data plus Better Auth user/account/session records. Planned; likely Cloudflare D1 + Drizzle.
- **Drizzle ORM** — database access and migrations. Planned; `drizzle-kit` is installed, but the ORM/schema is not yet wired.
- **Cloudflare KV** — **required** Better Auth secondary storage for sessions, verification, rate limits, and other short-lived key-value data. Planned.
- **Object storage** — uploaded post images. Planned; likely [Cloudflare R2](https://developers.cloudflare.com/r2/), but the service is not yet decided.

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
