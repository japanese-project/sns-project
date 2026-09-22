# sns-project

A small social app — posts, likes, comments, follow — built with [SvelteKit](https://svelte.dev/docs/kit) and deployed on [Cloudflare Workers](https://developers.cloudflare.com/workers/).

## Docs

- [Roadmap](./docs/roadmap.md) — MVP must-have phases, access rules, and post-MVP backlog
- [Tech Stack](./docs/tech-stack.md) — tools we use and planned architecture
- [Database & ERD](./docs/database.md) — core entities and relationships
- [Contributing](./docs/contributing.md) — setup, Lefthook workflow, and code style

## MVP

The MVP is the five-phase delivery plan: **Foundation** (auth) → **Posts** (text + visibility) → **Engagement** (likes/comments) → **Social graph** (follow) → **Completeness** (profiles, search, notifications, image upload).

Everything under Phases 1–5 is **MVP must-have**. The separate Post-MVP section contains features that are intentionally deferred.

See [docs/roadmap.md](./docs/roadmap.md) for the feature checklist and authorization rules.

## Setup

```sh
pnpm install
pnpm exec lefthook install   # registers git hooks
pnpm dev                     # or: pnpm dev -- --open
```

## Scripts

| Command                       | What it does                  |
| ----------------------------- | ----------------------------- |
| `pnpm dev`                    | start the dev server          |
| `pnpm build` / `pnpm preview` | production build / preview it |
| `pnpm check`                  | type-check                    |
| `pnpm lint` / `pnpm format`   | eslint / prettier             |
| `pnpm test`                   | vitest + playwright           |

## Contributing

Branch off `main` as `feature/<name>` or `fix/<name>`, keep each PR scoped to one roadmap item, open a PR into `main` — CI must pass, then squash-merge. See [docs/contributing.md](./docs/contributing.md) for the exact Lefthook checks and naming rules.
