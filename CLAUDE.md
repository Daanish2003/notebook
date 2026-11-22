# notebook

Better-T-Stack pnpm + Turborepo monorepo. Web: TanStack Start (also hosts the API + auth). Mobile: Expo + Uniwind. API: oRPC. DB: Postgres + Drizzle. Auth: Better Auth. Logging: evlog.

## Toolchain

- Node 24 (`.nvmrc`) — run `nvm use` first; Node 24.10 fails the stack's requirements.
- pnpm only (never npm/yarn/bun). Shared versions live in the `catalog:` in `pnpm-workspace.yaml` — add shared deps there and reference them as `"catalog:"`.

## Commands (run from repo root)

| Task                     | Command                                         |
| ------------------------ | ----------------------------------------------- |
| Dev (all / web / native) | `pnpm dev` / `pnpm dev:web` / `pnpm dev:native` |
| Lint / autofix           | `pnpm lint` / `pnpm lint:fix`                   |
| Format / check           | `pnpm format` / `pnpm format:check`             |
| Lint + format check      | `pnpm check` (`pnpm check:fix` to fix)          |
| Typecheck                | `pnpm check-types`                              |
| DB container             | `pnpm db:start` / `pnpm db:stop`                |
| Schema → migration       | `pnpm db:generate` then `pnpm db:migrate`       |
| Push schema (dev only)   | `pnpm db:push`                                  |
| Regenerate env types     | `pnpm env:generate`                             |
| Regenerate auth schema   | `pnpm auth:generate`                            |

Done = `pnpm check && pnpm check-types` passes.

## Layout

- `apps/web` — TanStack Start. Routes in `src/routes` (file-based; `routeTree.gen.ts` is generated, never edit). oRPC served at `src/routes/api/rpc/$.ts`, Better Auth at `src/routes/api/auth/$.ts`.
- `apps/native` — Expo Router app in `app/`; HeroUI Native + Uniwind (Tailwind v4) for UI.
- `packages/api` — oRPC procedures. `publicProcedure` / `protectedProcedure` in `src/index.ts`; routers in `src/routers/`, composed into `appRouter`.
- `packages/auth` — Better Auth server config.
- `packages/db` — Drizzle schema in `src/schema/` (re-export new tables from `src/schema/index.ts`), migrations in `src/migrations/`.
- `packages/ui` — shared shadcn/ui primitives for web (`@notebook/ui/components/*`). Add with `npx shadcn@latest add <name> -c packages/ui`.
- `packages/config` — shared tsconfig.

## Environment

Varlock: each app/package has a committed `.env.schema`; real values are in git-ignored `.env`. `src/env.ts` files are generated — edit the schema, then `pnpm env:generate`. Never commit `.env` or put secrets in schemas. Add any new env var used by a build to `globalEnv` in `turbo.json`.

## Conventions

- Lint/format: oxlint (`.oxlintrc.json`) + oxfmt (`.oxfmtrc.json`). Fix lint errors properly; don't add `oxlint-disable` without a reason in the comment.
- Type-only imports use `import { type X }` (enforced).
- Unused vars/args must be removed or prefixed `_`.
- New API endpoints: add to `packages/api/src/routers`, use `protectedProcedure` for anything user-specific, validate input with zod.
- Schema changes go through `db:generate` + `db:migrate` (commit the migration). `db:push` is for throwaway local experiments only.

## Git

- Conventional Commits, enforced by the `commit-msg` hook: `feat(web): …`, `fix(api): …`, `chore: …`. Scopes: `web`, `native`, `api`, `auth`, `db`, `ui`, `config`, `deps`.
- Lefthook hooks: pre-commit = oxlint --fix + oxfmt on staged files; pre-push = `pnpm check-types`. Don't bypass with `--no-verify` / `LEFTHOOK=0`.
