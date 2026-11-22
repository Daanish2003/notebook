# How the Bot SDK can use Notebook

Type: research
Status: resolved
Blocked by:

## Question

The Owner's Bot SDK app (`~/hobby/bot-sdk`, read-only for this research) should let a Bot use Notebook: add a Source by link, check a Transcription, search the Library, and read a Transcript with timestamps. From its code, `CONTEXT.md` and `docs/adr/`, what are the integration points?

- Can a Host offer a Connection whose tools come from an arbitrary MCP server (URL plus token)? How does ADR 0037 ("connection tokens come from the Host") apply, and what would a "Notebook" Connection need: streamable HTTP or SSE, auth header, per-user scoping?
- Could a Bot Skill on the user's Computer call a `notebook` CLI instead? What are the trade-offs?
- How do tool results of transcript size (~13k tokens) fit their Turn and context handling?
- Do they already use an MCP client library or SDK version we should match?

Also: what's the current best practice for a small TypeScript MCP server on Hono/Bun (official `@modelcontextprotocol/sdk` streamable HTTP transport, version and dates), and how Claude Code consumes the same server (`.mcp.json` / `claude mcp add --transport http`)? Cite file paths in bot-sdk and URLs for external docs.

## Answer

Research: [`research/bot-sdk-integration-points.md` on branch `research/bot-sdk-integration-points`](https://github.com/Daanish2003/notebook/blob/research/bot-sdk-integration-points/research/bot-sdk-integration-points.md). bot-sdk was read at commit `17cb8faa`, read-only.

- **How a Connection gets tools:** a Host declares an `McpConnection { key, name, mcp: { url } }` plus a `connection(userId, key)` token hook (ADR 0037). The Bot SDK connects over Streamable HTTP (HTTPS only, `Authorization: Bearer`, no OAuth discovery, no SSE). Tools appear as `<key>_<tool>`. Each is Auto-reviewed unless listed `approvalFree`, and `readOnlyHint` gates read-only runs. Per-user scoping is the hook returning a token only for the Owner's user id.
- **Blocker:** the SDK's guarded fetch refuses loopback, private and CGNAT addresses, so a `*.ts.net` URL (resolving to `100.x`) fails today. Fixes: (a) write the Notebook tools as Host tools in `apps/web` (unguarded, but the schemas are defined twice), or (b) add a per-Connection `privateNetwork: true` opt-in in `@botsdk/mcp` (about 15 lines plus a test, and an ADR 0037 amendment). Either way, the Bot SDK process must be on the tailnet.
- **Size:** the Bot SDK cuts tool results above 10,000 characters to their first and last 2,000. Page Transcript reads at 8,000 characters or less. Claude Code's limits are much looser.
- **Tools, not resources:** the Bot SDK lists only tools (`@tanstack/ai-mcp` 1.0.0 on `@modelcontextprotocol/client` 2.3.1, spec 2026-07-28). Claude Code also supports resources through `@` mentions.
- **Skills and CLI:** a Bot Skill plus a CLI is a poor fit, because the Bot's Computer is a cloud sandbox off the tailnet.
- **Server:** `@modelcontextprotocol/server` 2.4.0 `createMcpHandler` is stateless by default and mounts in Hono as a fetch handler, which suits on-demand start. Bearer and Host/Origin checks are ours, in front of it.
- **Claude Code:** `claude mcp add --transport http notebook <url> --scope user --header "Authorization: Bearer …"`. A skill works best as guidance on top of the MCP tools.
