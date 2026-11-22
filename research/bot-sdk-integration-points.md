# How the Bot SDK can use Notebook

Research for `.scratch/notebook-v1/issues/16-bot-sdk-integration-points.md`. It feeds `17-agent-access.md`.

Method: I read the Owner's Bot SDK repo at `~/hobby/bot-sdk` (read-only, at commit `17cb8faa`, "Merge pull request #1417 … connections-better-auth"). That covered `CONTEXT.md`, `AGENTS.md`/`CLAUDE.md`, ADRs 0023, 0025, 0027, 0029, 0034 and 0037, the source of `packages/botsdk/{mcp,skills,bot,computer-e2b}` and `apps/web/src`, and the installed `@tanstack/ai-mcp` and `@modelcontextprotocol/*` packages under its `node_modules`. External facts come from the MCP spec site, the MCP TypeScript SDK docs, the Claude Code docs and the npm registry, all read on 2026-11-22. Paths below are relative to `~/hobby/bot-sdk` unless they are URLs. Code is quoted only in short excerpts.

## Short answer

- A Host can add a Notebook Connection today. It declares one more `McpConnection` with `mcp: { url }`, and its `connection(userId, key)` hook returns a bearer token for the Owner's user id only.
- **One thing blocks it:** the SDK's MCP client fetches through an SSRF guard that refuses every non-public address. A tailnet name resolves to a CGNAT `100.x` address, so `https://omarchy.<tailnet>.ts.net/mcp` is refused. There are two ways round it:
  - **Host tools:** write the Notebook tools as Host tools in `apps/web`. These use the Host's own `fetch`, so the SDK needs no change.
  - **SDK opt-in:** add a small per-Connection opt-in to the SDK for private addresses.
- A transcript-sized result (~13k tokens, ~50k characters) does not fit in one Bot SDK tool result. Any result longer than **10,000 characters** is cut to its first and last 2,000 characters, and the full text is saved to a file on the Computer. Notebook's transcript tool must therefore page at about 8,000 characters. That page size also sits well inside Claude Code's limits (25k tokens, or 50k characters before a result is saved to a file).
- The Bot SDK uses `@tanstack/ai-mcp` 1.0.0, which sits on the **v2** MCP TypeScript SDK (`@modelcontextprotocol/client` 2.3.1). That client speaks the current spec revision, **2026-07-28**, and falls back to the 2025 handshake. Notebook should build on `@modelcontextprotocol/server` 2.4.0 with its web-standard `createMcpHandler`. That handler is stateless and has no sessions, which fits a server that socket-activates and stops after 15 minutes idle.
- A Bot Skill that runs a `notebook` CLI on the Computer is a poor fit. The Computer is a cloud E2B sandbox that is not on the tailnet, and joining it would break ADR 0001's trust model.

## Part 1: the Bot SDK

### 1.1 How a Connection gets its tools from an MCP server

**Declaring a Connection.** The `mcp` feature takes `connections` and a `connection` hook (`packages/botsdk/mcp/src/server/plugin.ts:19-30`, `mcp()` at `:53-79`). Each Connection has one of two sources (`packages/botsdk/mcp/src/server/connections.ts`):

```ts
type McpSource = { mcp: { url: string; tools?: string[] }; tools?: never }; // :38-46
type HostToolsSource = { tools: HostTool[]; mcp?: never }; // :49
export type McpConnection = (McpSource | HostToolsSource) & {
  key: string;
  name: string;
  approvalFree?: string[];
  readOnlyTools?: string[]; // :56-68
};
```

- `url` is "The server's Streamable HTTP endpoint. HTTPS only." (`connections.ts:40`).
- `checkConnections` enforces that rule when the Host boots (`:93-139`). Plain `http:` is allowed only for a host in the test-only `fetchAllowHosts` (`:132-137`).

**Opening the client.** The tools are opened once per Turn by `openMcpTools` (`packages/botsdk/mcp/src/server/tools.ts:34-98`):

```ts
client = await createMCPClient({
  transport: {
    type: "http",
    url: server.mcp.url,
    headers: { authorization: `Bearer ${accessToken}` },
    fetch: deps.fetch,
  },
  name: "ai-chat",
  prefix: server.key,
  toolFilter: (tool) => !server.mcp.tools || server.mcp.tools.includes(tool.name),
  needsApproval: (tool) => !(server.approvalFree ?? []).includes(tool.name),
}); // tools.ts:62-73
```

- **Transport:** `type: "http"` maps to `StreamableHTTPClientTransport`. SSE exists in the library (`@tanstack/ai-mcp/dist/esm/transport.js:76-81`), but the Bot SDK never selects it.
- **Auth:** the hook's token is sent as `Authorization: Bearer …`. There is no OAuth discovery or client registration (doc comment at `tools.ts:22-33`).
- **Naming:** tools are named `<key>_<tool>`. An MCP tool called `search` on a Connection keyed `notebook` reaches the Bot as `notebook_search`. Notebook's MCP tool names should therefore not carry a `notebook_` prefix themselves.
- **Read-only:** a tool counts as read-only in a read-only run (such as the Watch Routine) if the server marks it `annotations.readOnlyHint: true`, or if the Host lists it in `readOnlyTools` (`tools.ts:75-83`).
- **Failure:** if the server is down or answers 401, its tools are left out of the Turn (`tools.ts:88-92`). A later call then gets the reconnect error, "Connection X needs reconnecting in Settings; tell the user." (`connector-tools.ts:23-24`).

**How the Turn treats the tools.** `connectorTools` (`packages/botsdk/mcp/src/server/connector-tools.ts:104-194`):

- Lists them as **Deferred tools**. The Bot calls `describe_tool` and then `run_tool` (`packages/botsdk/bot/src/bot/context/tool-search.ts:10-11`).
- Records the listing so that a replayed Turn sees the same tools.
- Masks the user's Secrets out of results.
- Fences every result as untrusted data (`connectorResultLabel`, `:31-32`; `untrustedBlock`, `packages/botsdk/bot/src/bot/routines/routine.ts:187-193`).
- Sends every call through Auto-review unless the tool is listed `approvalFree` (`CONTEXT.md:75-76`).

**How results reach the model.** A string result stays a string. Anything else is `JSON.stringify`'d (`connector-tools.ts:44`). The client returns `structuredContent` only when the tool declares an `outputSchema`; otherwise it flattens `content[]`, and a single text block becomes a plain string (`@tanstack/ai-mcp/dist/esm/tools.js:45-47, 383-392`). An `isError: true` result is thrown as an `Error` carrying its text, and the Bot sees it fenced as the call's answer.

**The SDK-side tests show the expected wiring:** `packages/botsdk/mcp/test/mcp-tools.integration.test.ts` and `test/routers/bot-connectors*.integration.test.ts`.

### 1.2 Can a Host add a custom MCP-server Connection (URL plus token)?

Yes. Nothing restricts which server a Connection points at. The Host declares it in code, and there is no in-app "add a server" UI. `apps/web` does exactly this for GitHub (`apps/web/src/connections.ts:76-88`, `url: "https://api.githubcopilot.com/mcp/"`). Google Calendar, Gmail and Notion are Host-tools Connections instead (`:89-117`).

**How ADR 0037 applies.** ADR 0037 ("A Connection's token comes from the Host through a hook", `docs/adr/0037-connection-tokens-come-from-the-host.md:9-11`) says:

- the SDK holds no tokens;
- the Host's hook `connection(userId, key)` returns `{ accessToken }`, `{ reconnect: true }` or `null`;
- "each Connection is its own link-only Better Auth provider id".

`apps/web` follows that: `connectionHookOf` and `connectionTokensOf` read Better Auth's `account` rows (`apps/web/src/connections.ts:126-150`).

The hook's type does not require OAuth, though (`connections.ts:75-81`). A Notebook hook can return a static per-client token for one user. That goes against the ADR's "Better Auth provider" wording, so the Host's choice should be recorded as an amendment to 0037. The ADR's own consequence line already concedes the general case: "An official MCP server fits only if it accepts a token we mint" (`:23`).

**What a Notebook Connection needs:**

| Need             | What the Bot SDK requires                                                                                         | Notebook's side                                                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Transport        | Streamable HTTP, over HTTPS only (`connections.ts:40, 132-137`). SSE is never used.                               | One `POST /mcp` endpoint behind `tailscale serve`. The ts.net certificate satisfies HTTPS.                                                   |
| Auth header      | `Authorization: Bearer <token from the hook>` (`tools.ts:66`), with no OAuth discovery.                           | Check a bearer token on `/mcp` and answer 401 when it is wrong. A 401 makes the SDK skip the tools and the Bot reports "needs reconnecting". |
| Per-user scoping | The hook gets the `userId`. Returning `null` for anyone but the Owner means no tools for them (`tools.ts:51-55`). | Nothing. The token itself is the Owner's.                                                                                                    |
| Network reach    | `deps.fetch` is the guarded fetch (see the blocker below).                                                        | It must be reachable from the Bot SDK server's process, which must be on the tailnet.                                                        |

**Blocker: the SSRF guard refuses tailnet addresses.**

- `createBotSdk` builds `fetch` as `createGuardedFetch({ schemes: "http-and-https", allowHosts: fetchAllowHosts })` (`packages/botsdk/bot/src/create-chat.ts:549`).
- The guard allows only global-unicast addresses: "Refuses loopback, private, CGNAT, link-local, ULA and the rest." (`packages/botsdk/bot/src/lib/guarded-fetch.ts:47-51`).
- Tailscale addresses are CGNAT (`100.64.0.0/10`), and so is MagicDNS's answer for `omarchy.<tailnet>.ts.net`. Loopback (`127.0.0.1:4310`) is refused as well.
- The only escape hatch is `fetchAllowHosts`. `apps/web` documents it as test-only and refuses it at start-up unless `BETTER_AUTH_URL` is localhost (`apps/web/src/ssrf-allow.ts:1-19`). Relying on it for a real Connection would be a misuse.

So an `mcp: { url }` Notebook Connection fails today with `BlockedAddressError`. There are three options.

1. **Host tools, no SDK change.** Write the Notebook tools in `apps/web/src/notebook.ts`, the way `notion.ts` does. Its `notionTools(fetch = globalThis.fetch)` calls the API with the token it is handed (`apps/web/src/notion.ts:171`). Host tools get their token through the same hook, Auto-review and fencing, and they skip the guard. The cost is that Notebook's tool schemas are written twice: once on Notebook's MCP server for Claude Code, and once in `apps/web`. Calling Notebook's own MCP endpoint from inside the Host tools, with `createMCPClient` and an unguarded fetch, avoids that duplication but means writing the client wiring by hand.
2. **A small SDK change (recommended if the Owner is happy to touch the SDK).** Add an opt-in on `McpSource`, for example `mcp: { url, privateNetwork: true }`:
   - `checkConnections` accepts it, still HTTPS only;
   - `openMcpTools` gives that one client a fetch that allows private addresses for that exact host only, and still strips the bearer token on a cross-origin redirect (as `guarded-fetch.ts:97-104` does).
   - Roughly 15 lines across `connections.ts` and `tools.ts`, plus a test and an amendment to ADR 0037. Every other Connection keeps the guard.
3. **`fetchAllowHosts`:** works mechanically, but it is test-only by design (see above).

**Smaller rough edges:**

- `listConnections` returns every Connection the Host declares to every user (`connections.ts:195-226`). Other users of the Host would see a "Notebook: disconnected" row. Either the Host's Settings UI hides it for anyone but the Owner, or the SDK gains an optional per-user `offeredTo(userId)`. Only the Host-side option avoids an SDK change.
- Settings' Connect/Disconnect is owned by the Host (ADR 0037 `:10`). A token-based Connection needs a "paste token" or env-configured path, not an OAuth button.
- The Host must only declare the Connection when it is configured, as `connectionsOf` already does for each provider's env vars (`apps/web/src/connections.ts:67-119`).

### 1.3 Skills, and whether a Bot Skill can run a CLI on the Computer

**Where Skills live.** A Skill is a plain `SKILL.md` in `/home/user/bots/<botId>/skills/<name>/` on the user's Computer (`packages/botsdk/bot/src/bot/skill-files.ts:8-10`). The `skills` feature `needs: ["computer"]` (`packages/botsdk/skills/src/server/plugin.ts:15-18`).

**How they load.** The Prompt start lists each Skill's `name: description`, capped at 8,000 characters in total (`packages/botsdk/skills/src/server/skills.ts:21, 82-120`). The Bot reads the body with `read` when a task matches. The required frontmatter is `description: Use this when …`, at most 200 characters (`skills.ts:99`). `CONTEXT.md:185-186` adds: "A Skill is never permission to act."

**Can a Skill run a CLI?** Yes. A Skill is instructions, and the Bot carries them out with its `shell` tool on the Computer:

- Commands run with `bash -l -c`.
- The tool takes a `secrets` list whose values are set as env vars for that command only (`packages/botsdk/bot/src/bot/agent-loop/computer-tools.ts:150-176`).
- Every shell call goes through Auto-review (`packages/botsdk/bot/src/bot/agent-loop/loop.ts:836`).
- Output over 10,000 characters is cut and spilled to a file (`computer-tools.ts:242-267`).

**Why the CLI route is a poor fit for Notebook:**

- **Network.** The Computer is a self-hosted E2B Firecracker sandbox (`packages/botsdk/computer-e2b/src/index.ts:21-33, 98-108`). Its template is plain Debian with Chromium and no Tailscale (`packages/botsdk/computer-e2b/template/Dockerfile:9-13`), so it cannot reach `omarchy.<tailnet>.ts.net`. Making it reach Notebook means Tailscale inside the template and an auth key per Computer. That makes an agent sandbox, which browses the web and runs injected-text-prone tasks, a full tailnet node. ADR 0001 treats every tailnet device as already authenticated, so this widens the trust boundary considerably. Changing the template also rebuilds every Computer (Dockerfile header comment).
- **Packaging.** The `notebook` CLI would have to be installed in the template or by the Bot at runtime.
- **Scope.** Skills are per-Bot, so each Bot needs its own copy. Connections are shared by all of a user's Bots (`CONTEXT.md:71-72`).
- **Review quality.** Auto-review sees an opaque shell line, not a typed tool call with `readOnlyHint`, and the Watch's read-only run cannot tell a read from a write.
- **What it would buy:** it works without an SDK change, the token is a Secret the model never sees, and the CLI can also serve the Owner by hand.

**Verdict:** a Bot should use Notebook as a Connection, not as a Skill plus CLI. A Bot Skill can still hold the _how_, for example "when the user pastes a talk link, call `notebook_add_source`, then poll `notebook_get_status`". That costs nothing extra.

### 1.4 Large tool results in a Turn

- **Every tool call, Connector tools included, is capped.** Feature tools run through `liveRequest` (`packages/botsdk/bot/src/bot/context/features.ts:227-236`). There the result is masked, then `capLong` → `capResult` is applied (`loop.ts:675-684, 709, 728`).
- **The rule** (`computer-tools.ts:178-188, 201-235`):

  ```ts
  export const spillThreshold = 10_000; // characters of JSON.stringify(result)
  const spillKeep = 2_000; // kept from each end
  // over the threshold: first 2,000 + "[... N characters left out ...]" + last 2,000,
  // full text saved at /home/user/bots/<botId>/.outputs/<toolCallId>.txt
  ```

  With a Computer, the Bot can then page through the saved file with `read`, at most 10,000 characters per page (`computer-tools.ts:298`). Without a Computer, the rest is lost ("The rest was not saved.").

- **What that means for a transcript:**
  - A ~13k-token Transcript (~50k characters) returned in one call reaches the model as ~4k characters plus a file path. The middle 92% is only on disk. That works, but it is wasteful: it costs an extra `read` round per 10k characters, and the file lives in the Bot's directory.
  - The fence label plus JSON string escaping (`\n` becomes two characters, quotes are escaped) add a few percent. A page of **≤ 8,000 characters** of Markdown stays safely under the cap.
- **Context limits more broadly:**
  - Large inputs eventually trigger a **Summary**: a Turn whose last Step's input was over 100,000 tokens queues one (`packages/botsdk/bot/src/bot/context/summary.ts:24-28`).
  - The Prompt start (tools, system prompt, deferred-tool names) stays fixed until the next Summary (`CONTEXT.md` "Prompt start", "Deferred tool"). Adding a Connection's tools changes only the deferred list, and the Bot is told through a Change note.
  - There is no per-Turn token budget for tool results beyond the 10k cut, so many full pages in one Turn would push the conversation toward a Summary sooner. Search hits with timestamps should therefore be the default way in, and ranged reads the follow-up.

### 1.5 MCP client library and version

- `packages/botsdk/mcp/package.json` depends on `"@tanstack/ai": "1.0.0"` and `"@tanstack/ai-mcp": "1.0.0"`. The repo has no direct `@modelcontextprotocol/*` dependency.
- `@tanstack/ai-mcp@1.0.0` depends on `@modelcontextprotocol/client` and `@modelcontextprotocol/server` `^2.0.0`. The lockfile resolves both to **2.3.1**, the v2 TypeScript SDK. A v1 `@modelcontextprotocol/sdk@1.32.0` is also present, but only as a transitive dependency.
- The installed v2 client defines `MODERN_PROTOCOL_VERSION = "2026-07-28"`, keeps `SUPPORTED_PROTOCOL_VERSIONS` back to `2024-11-05` for the legacy handshake, and sends `Mcp-Param-*` headers (`ai-mcp/dist/esm/tools.js:383-392`).
- **Implication:** Notebook should use the v2 server SDK. Its default handler answers both modern and legacy clients. Matching the exact minor (2.3.x) is not needed, since the wire protocol is what has to match.

## Part 2: external best practice

### 2.1 Current spec and SDK versions

| Item                                        | Version        | Date       | Source                                                                                                  |
| ------------------------------------------- | -------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| MCP specification, current revision         | **2026-07-28** | —          | https://modelcontextprotocol.io/specification/versioning ("The current protocol version is 2026-07-28") |
| Previous revision (handshake-based)         | 2025-11-25     | —          | same page, "Backward Compatibility"                                                                     |
| `@modelcontextprotocol/server` (v2, stable) | 2.4.0          | 2026-10-23 | `npm view @modelcontextprotocol/server` (2.0.0 published 2026-07-27)                                    |
| `@modelcontextprotocol/hono`                | 2.0.2          | 2026-10-02 | `npm view @modelcontextprotocol/hono`                                                                   |
| `@modelcontextprotocol/sdk` (v1 line)       | 1.32.2         | 2026-10-23 | `npm view @modelcontextprotocol/sdk`                                                                    |

The v2 server README says it "implement[s] the 2026-07-28 MCP spec" and "replaces the single `@modelcontextprotocol/sdk` package from v1" (npm readme of `@modelcontextprotocol/server`).

### 2.2 What changed in Streamable HTTP in 2026-07-28 (stateless by protocol)

From https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http:

- **No sessions:** "Removal of the GET stream endpoint. Removal of protocol-level sessions."
- **One endpoint, POST only:** "The server exposes a single HTTP endpoint (the MCP endpoint) that accepts POST." Each request gets either JSON or a per-request SSE stream.
- **Required headers:** every POST carries `MCP-Protocol-Version`, `Mcp-Method`, and `Mcp-Name` (for `tools/call` and `resources/read`). The server must reject mismatches with 400 and `HeaderMismatch` (-32020).
- **Security:** "Servers MUST validate the `Origin` header … If the `Origin` header is present and invalid, servers MUST respond with HTTP 403" and "SHOULD implement proper authentication for all connections."
- **Legacy traffic:** a modern-only server answers GET/DELETE with 405 and ignores `Mcp-Session-Id`.
- **Server-to-client requests** (elicitation, sampling) became Multi Round-Trip Requests inside results. Notebook needs none of them.

On stateful tools, https://modelcontextprotocol.io/specification/2026-07-28/server/tools says: "MCP has no protocol-level session … return an explicit handle". For Notebook, that handle is simply the `sourceId` plus a page `cursor`.

### 2.3 Building the server on Hono/Bun

From the v2 serving guide (https://ts.sdk.modelcontextprotocol.io/v2/serving/http) and the legacy-clients page (https://ts.sdk.modelcontextprotocol.io/v2/serving/legacy-clients):

- **Handler:** `createMcpHandler(factory)` takes a factory that builds a fresh `McpServer` per request and returns `{ fetch, close, notify, bus }`. `handler.fetch` is a web-standard `(Request) => Promise<Response>`. "On web-standard runtimes (… Bun), `export default handler` is the entire mount."
- **Statelessness:** "The factory runs once per request, and the handler holds no state between requests." Legacy (2025-era) clients are served by default with `legacy: 'stateless'`: each `initialize` gets a fresh instance. `legacy: 'reject'` makes the endpoint modern-only.
- **Response mode:** `responseMode: 'json'` pins plain JSON responses and drops mid-call notifications. That is fine for Notebook, which has no progress streaming.
- **Auth:** "The handler does not verify tokens. Verify the token in front of the handler and pass the result as the second argument: `handler.fetch(request, { authInfo })`." Tools read it as `ctx.http.authInfo`. `requireBearerAuth` exists for this, but a plain Hono `bearerAuth({ verifyToken })` middleware in front of the route does the same job (https://hono.dev/docs/middleware/builtin/bearer-auth).
- **Host and Origin validation:** the handler does not do it. Use `hostHeaderValidationResponse` and `originValidationResponse` from `@modelcontextprotocol/server` in front of it. `@modelcontextprotocol/hono` exports `createMcpHonoApp()`, `hostHeaderValidation(allowedHostnames)` and `localhostHostValidation()`, and its README shows the older `WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })` stateless pattern. Notebook is reached as `omarchy.<tailnet>.ts.net`, so it should validate `Host` against that name (and `127.0.0.1:4310` for local use). Origin should be absent or Notebook's own origin.

**Mount sketch:** this follows the docs above. It is not run here.

```ts
const mcp = createMcpHandler(() => buildNotebookMcpServer(deps), { responseMode: "json" });
app.use("/mcp", hostCheck, originCheck, bearerAuth({ verifyToken: verifyAgentToken }));
app.post("/mcp", (c) => mcp.fetch(c.req.raw, { authInfo: c.get("agentToken") }));
```

**Why stateless fits Notebook:** it is socket-activated and stops after 15 minutes idle (issue 09). Sessionful MCP would lose its sessions on every stop. Stateless requests just wake the server.

### 2.4 Auth for an MCP server

From https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization:

- **Optional:** "Authorization is OPTIONAL for MCP implementations." When it is done over HTTP, "authorization MUST be included in every HTTP request", "Access tokens MUST NOT be included in the URI query string", "Invalid or expired tokens MUST receive an HTTP 401 response".
- **Full OAuth is too much here.** The OAuth 2.1 profile (Protected Resource Metadata, PKCE, resource indicators) applies when a server takes part in OAuth. A pre-shared bearer token is outside that profile but within "optional", and both target clients support static headers. Claude Code's MCP docs say that an `Authorization` header supplied by the configuration is used as the credential and Claude Code "doesn't fall back to OAuth" (https://code.claude.com/docs/en/mcp, `headersHelper` section). The Bot SDK sends only the hook's token.

### 2.5 Tool output size, pagination, and tool vs resource

- **The spec sets no size limit.** Pagination in the spec is for _list_ methods (`cursor`/`nextCursor`). For tool results, a handle-and-cursor in arguments is the documented pattern (tools page, "Stateful Tools").
- **Structured output:** "For backwards compatibility, a tool that returns structured content SHOULD also return the serialized JSON in a TextContent block." If an `outputSchema` is given, "Servers MUST provide structured results that conform". The Bot SDK client returns `structuredContent` (then stringifies it) only when the tool has an `outputSchema`; otherwise it passes the text. For transcript pages, Markdown text with no `outputSchema` is the most compact.
- **Errors:** they go in `isError: true` results so the model can self-correct (tools page, "Error Handling").
- **Claude Code's limits** (https://code.claude.com/docs/en/mcp, "MCP output limits and warnings"):
  - a warning when output exceeds 10,000 tokens;
  - a default maximum of 25,000 tokens (`MAX_MCP_OUTPUT_TOKENS`);
  - a text result over 50,000 characters is saved to a file and replaced by its path;
  - a per-tool `_meta["anthropic/maxResultSizeChars"]` can raise that, up to 500,000;
  - a response over 16 MiB fails, and the docs advise "paginating results".
  - The Bot SDK's 10,000-character cut is therefore the binding constraint, by a factor of five.
- **Resources vs tools:** tools are "model-controlled" and resources are "application-driven, with host applications determining how to incorporate context" (https://modelcontextprotocol.io/specification/2026-07-28/server/resources). Resource templates (`resources/templates/list`, RFC 6570) suit `notebook://source/{id}/transcript`.
  - Claude Code supports resources through `@server:protocol://path` mentions and "automatically provides tools to list and read MCP resources" (mcp docs, "Use MCP resources").
  - The Bot SDK only calls `client.tools()` (`tools.ts:75`), so it **ignores resources**.
  - So transcript reads must be a **tool**. A resource template is an optional extra for the Owner's `@`-mentions in Claude Code. A whole-transcript resource is fetched as an attachment in one piece, so it skips paging; keep it for deliberate use.
- **Tool annotations** (`readOnlyHint` and the rest) are hints that "clients MUST consider … untrusted unless they come from trusted servers" (tools page). The Bot SDK trusts `readOnlyHint` for read-only runs (`tools.ts:79-81`). Notebook should set it on every read tool.

### 2.6 How Claude Code consumes the same server

From https://code.claude.com/docs/en/mcp:

```bash
claude mcp add --transport http notebook https://omarchy.<tailnet>.ts.net/mcp \
  --scope user --header "Authorization: Bearer $NOTEBOOK_TOKEN"
```

- **Scopes:** `local` (the default), `project` (stored in `.mcp.json`) and `user` (all projects). For a personal Library on every project, `user` is right.
- **`.mcp.json` format:**

  ```json
  {
    "mcpServers": {
      "notebook": {
        "type": "http",
        "url": "https://omarchy.<tailnet>.ts.net/mcp",
        "headers": { "Authorization": "Bearer ${NOTEBOOK_TOKEN}" }
      }
    }
  }
  ```

  `${VAR}` and `${VAR:-default}` expand in `url` and `headers`. Only names in Claude Code's own credential set, such as `ANTHROPIC_API_KEY`, read as empty there. A `headersHelper` script can supply dynamic headers and is re-run on 401/403.

- **SSE:** "The SSE (Server-Sent Events) transport is deprecated. Use HTTP servers instead." Claude Code tries HTTP first.
- **Tool search** is on by default, so MCP tools load on demand, much like the Bot SDK's Deferred tools.

### 2.7 A Claude Code skill wrapping a CLI, compared with MCP

From https://code.claude.com/docs/en/skills:

- **Location:** `~/.claude/skills/<name>/SKILL.md` (personal: "All your projects on this machine, but not Cowork or cloud sessions"), `.claude/skills/…` (project), or `<plugin>/skills/…`.
- **Frontmatter:**
  - "All fields are optional. Only `description` is recommended."
  - "Claude uses this to decide when to apply the skill … the combined `description` and `when_to_use` text is truncated at 1,536 characters."
  - `when_to_use` holds trigger phrases.
  - `disable-model-invocation: true` stops automatic use.
  - `allowed-tools` pre-approves tools for that turn, for example `Bash(notebook *)`, or `Bash(${CLAUDE_SKILL_DIR}/scripts/x.sh *)` for a bundled script.
- **Loading:** "skill descriptions are loaded into context … full skill content only loads when invoked." `` !`cmd` `` injects command output before the skill reaches the model.

|                        | MCP server (`/mcp`)                                         | Skill + `notebook` CLI                         |
| ---------------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| Bot SDK can use it     | Yes, as a Connection (after the guard fix or as Host tools) | Only on a tailnet-joined Computer (see 1.3)    |
| Claude Code can use it | Yes, typed tools plus `@` resources                         | Yes, through Bash                              |
| Output control         | Server pages it; size limits documented                     | stdout; Claude Code's Bash output limits apply |
| Install                | One `claude mcp add`                                        | A CLI binary on PATH plus a skill folder       |
| Triggering             | Tool descriptions, through tool search                      | Skill description (≤1,536 characters)          |
| Auth                   | Bearer header                                               | CLI reads a token file or env var              |

An MCP server serves both clients. A skill is still useful _on top of_ MCP, as a few lines on when to reach for the Notebook tools (for example "transcribe this link", "what did that talk say about …"), with no CLI needed. A CLI only earns its place if the Owner wants shell use or scripting.

## Implications for Notebook

### Recommended surfaces

1. **An MCP endpoint on the Notebook server:**
   - `POST /mcp` in the same Hono process (`127.0.0.1:4310`, behind `tailscale serve`).
   - Built on `@modelcontextprotocol/server` ^2.4 `createMcpHandler`, with `responseMode: "json"` and the default `legacy: 'stateless'`.
   - Tools call the same domain modules the oRPC routers use, so there is no second business layer.
   - This is the one surface both Claude Code and the Bot SDK consume.
2. **A Claude Code skill (optional, small)** at `~/.claude/skills/notebook/SKILL.md`. It holds no CLI, only guidance that points at the MCP tools: search first, then read ranges around hits, and add by URL then poll status. Its description should name the triggers ("transcribe this link/video/podcast", "what did <talk> say about…", "search my Library/Notebook").
3. **No `notebook` CLI for v1.** Nothing above needs one. If one is wanted later, it can be a thin MCP or oRPC client sharing the same token.
4. **An optional resource template** `notebook://source/{sourceId}/transcript` (Markdown) for `@`-mentions in Claude Code. The Bot SDK ignores it.

### Draft tool list

Names are unprefixed. The Bot sees `notebook_<name>`; Claude Code sees `mcp__notebook__<name>`. All reads carry `annotations: { readOnlyHint: true, openWorldHint: false }`. Each one-line result stays well under 8,000 characters.

| Tool             | Input                                                                                                  | Output                                                                                                                                                           | Notes                                                                                                                                                                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search`         | `{ query: string, tags?: string[], channel?: string, limit?: int ≤ 20 (default 10), cursor?: string }` | `{ hits: [{ sourceId, title, segmentId, startMs, at: "mm:ss", snippet }], nextCursor? }`                                                                         | FTS5 over Segments (issue 06). Default entry point.                                                                                                                                                                                                                                                |
| `list_recent`    | `{ limit?: int ≤ 25, cursor?: string, tags?: string[] }`                                               | `{ sources: [{ sourceId, title, channel?, addedAt, durationMs, state, tags }], nextCursor? }`                                                                    | Excludes Recently deleted.                                                                                                                                                                                                                                                                         |
| `get_source`     | `{ sourceId }`                                                                                         | `{ sourceId, title, channel?, url?, durationMs, language, state, tags, outline: [{ title, startMs }], transcriptChars }`                                         | Lets the agent plan ranged reads.                                                                                                                                                                                                                                                                  |
| `get_transcript` | `{ sourceId, fromMs?: int, toMs?: int, cursor?: string, format?: "markdown" \| "segments" }`           | markdown: text with `[mm:ss]` at each paragraph, then a last line `next: <cursor>`. segments: `{ segments: [{ segmentId, startMs, endMs, text }], nextCursor? }` | Pages of ≤ 8,000 characters, cut on paragraph boundaries. Fillers stripped as on render. Markdown has no `outputSchema`, so it stays plain text in the Bot SDK.                                                                                                                                    |
| `get_status`     | `{ sourceId }`                                                                                         | `{ sourceId, state: "queued" \| "processing" \| "done" \| "failed", progress?: 0–1, error?: string, attempts }`                                                  | For polling after `add_source`.                                                                                                                                                                                                                                                                    |
| `list_tags`      | `{}`                                                                                                   | `{ tags: [{ name, count }] }`                                                                                                                                    |                                                                                                                                                                                                                                                                                                    |
| `add_source`     | `{ url: string, tags?: string[] }`                                                                     | `{ sourceId, state, duplicateOf?: sourceId }`                                                                                                                    | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: true` (the same URL returns the existing Source), `openWorldHint: true`. In the Bot SDK it is Auto-reviewed unless the Host lists it `approvalFree`. Upload-by-file is left out: neither client has a natural way to send bytes. |

Edits, deletes, Tag changes and Export stay out of the agent surface unless ticket 17 decides otherwise. Export in particular is "the only way Library data reaches a device", and it is a browser download.

### Auth approach that fits both clients

- **The token:** a per-client bearer token required on `/mcp` only. The PWA keeps ADR 0001's no-login model. ADR 0001 needs an amendment saying that non-browser agent clients present a token, because an MCP endpoint reached by a cloud-hosted agent process is not the same trust case as a tailnet browser.
- **Storage:** an `agent_token` table holding `id`, `name` ("claude-code-laptop", "bot-sdk"), `sha256(token)`, `createdAt`, `lastUsedAt` and `revokedAt`. A token is shown once at creation, made in the PWA's settings or by a one-off server command, and revoked by setting `revokedAt`. A wrong or revoked token gets a 401.
- **Request checks:** also validate `Host` against the ts.net name and localhost, and refuse a present-but-foreign `Origin` with 403, per the spec.
- **Claude Code:** `--header "Authorization: Bearer …"` at user scope, or a `headersHelper` that reads the token from a file.
- **Bot SDK:** the Host's `connection(userId, "notebook")` returns `{ accessToken: NOTEBOOK_TOKEN }` when `userId === NOTEBOOK_OWNER_USER_ID`, and `null` otherwise. Only the Owner's Bots get the tools. This is a Host-side policy, not an OAuth link, so it is worth an ADR 0037 amendment.

### What the Bot SDK needs changed to add a Notebook Connection

- **No change to the SDK** if the Notebook tools are written as Host tools (`apps/web/src/notebook.ts`, using the Host's own `fetch`). In `apps/web` that means:
  - one `connectionsOf` entry (`key: "notebook"`, `approvalFree` and `readOnlyTools` covering the read tools);
  - a hook branch that answers for the Owner's user id only;
  - env vars for the URL, token and owner id;
  - hiding the Settings row from other users.
- **A small SDK change** to use `mcp: { url }` directly, the cleaner single-definition path:
  - a per-Connection `privateNetwork: true` (HTTPS still required) that gives that Connection's client a fetch allowing private and CGNAT addresses for its own host only, keeping redirect token-stripping;
  - a test, and an ADR 0037 amendment.
  - An optional per-user `offeredTo(userId)` filter on Connections would make the Settings row clean without Host UI work.
- **Either way:**
  - the process running the Bot SDK must be on the Owner's tailnet;
  - the Computer is not involved;
  - the cut-and-spill behaviour needs no change, as long as Notebook pages at ~8,000 characters.
