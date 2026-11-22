---
paths:
  - "packages/api/**"
  - "apps/server/**"
---

# API (oRPC)

- Add procedures in `packages/api/src/routers/`: one router per domain, composed into `appRouter` in `routers/index.ts`. The web client gets its types from `AppRouterClient`.
- Use `protectedProcedure` for anything that touches user data, and scope every query to `context.session.user.id`. Use `publicProcedure` only for data that is public on purpose.
- Validate every input with a zod schema in `.input(...)`. Throw `ORPCError` with a standard code (`NOT_FOUND`, `FORBIDDEN`, `BAD_REQUEST`) for expected failures.
- `apps/server/src/index.ts` is transport glue (Hono middleware, `/rpc`, `/api/auth/*`). Put logic in procedures. The exception is raw file uploads, which stream through a plain Hono route because oRPC is JSON.
