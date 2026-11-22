---
paths:
  - "packages/api/**"
  - "apps/web/src/routes/api/**"
---

# API (oRPC)

- Add procedures in `packages/api/src/routers/`: one router per domain, composed into `appRouter` in `routers/index.ts`. The web and native clients get their types from `AppRouter`, so the change reaches both.
- Use `protectedProcedure` for anything that touches user data, and scope every query to `context.session.user.id`. Use `publicProcedure` only for data that is public on purpose.
- Validate every input with a zod schema in `.input(...)`. Throw `ORPCError` with a standard code (`NOT_FOUND`, `FORBIDDEN`, `BAD_REQUEST`) for expected failures.
- `apps/web/src/routes/api/rpc/$.ts` and `api/auth/$.ts` are transport glue. Put logic in procedures, not there.
