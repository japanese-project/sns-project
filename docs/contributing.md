# Contributing

## Setup

```sh
pnpm install
pnpm exec lefthook install   # registers git hooks
pnpm dev
```

## Before you push

The repository uses Lefthook for local Git checks. The hooks currently configured in `lefthook.yml` are:

- **pre-commit:** ESLint with `--fix` for staged `.ts` / `.tsx` files; fixed files are re-staged automatically.
- **pre-push:** `pnpm audit`, `pnpm run check`, `pnpm run format:check`, and `pnpm run lint`.
- **Tests:** not run by Lefthook; run them locally before pushing because CI runs the test suite.

Run the full local checks manually with:

```sh
pnpm run check
pnpm run lint
pnpm run format:check
pnpm run test
pnpm audit
```

## Workflow

1. Branch off `main`: `feature/<short-name>` or `fix/<short-name>`.
2. Keep PRs scoped to one [roadmap](./roadmap.md) item where possible.
3. Open a PR into `main` — CI must pass.
4. Squash-merge once approved.

## Code style

- Variables and functions: `snake_case`. This is enforced by `@typescript-eslint/naming-convention` in `eslint.config.js`.
- Lefthook auto-fixes staged TypeScript variables/functions on **pre-commit**.
- Formatting: Prettier. Lefthook checks formatting on **pre-push**; it does not rewrite files there.
- Run `pnpm run format` to apply Prettier formatting before pushing.

The docs use the same conventions as the source configuration; if `lefthook.yml` or `eslint.config.js` changes, update this guide in the same PR.
