---
paths:
  - "packages/db/**"
---

# Database (Drizzle + SQLite)

- Tables live in `packages/db/src/schema/`, one file per domain. Re-export each new file from `schema/index.ts`; drizzle-kit only sees what that file exports. Declare relations in `src/relations.ts`.
- Change the schema through migrations: `pnpm db:generate`, review the generated SQL in `src/migrations/`, then `pnpm db:migrate` after I OK it. Commit the migration together with the schema change.
- `pnpm db:push` is for throwaway local experiments only, and only with my OK.
- The schema is specified in `.scratch/notebook-v1/spec.md` (Schema). The Python worker writes to the same SQLite file with plain SQL, so schema changes start here and the worker's SQL follows. Open the file in WAL mode with a busy timeout.
