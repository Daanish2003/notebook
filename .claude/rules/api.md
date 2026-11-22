---
paths:
  - "packages/api/**"
  - "apps/server/**"
---

# API (oRPC)

- Add procedures in `packages/api/src/routers/`: one router per domain, composed into `appRouter` in `routers/index.ts`. The web client gets its types from `AppRouterClient`.
- There is no app auth (ADR 0001): every oRPC procedure is a `publicProcedure`, reachable only over the tailnet. Agent access goes through `/mcp` with an agent token (ADR 0003), never through oRPC.
- Validate every input with a zod schema in `.input(...)`. Throw `ORPCError` with a standard code (`NOT_FOUND`, `FORBIDDEN`, `BAD_REQUEST`) for expected failures.
- `apps/server/src/index.ts` is transport glue (Hono middleware, `/rpc`, `/mcp`, uploads, media, Export downloads). Put logic in procedures. The exception is raw file uploads, which stream through a plain Hono route because oRPC is JSON.
