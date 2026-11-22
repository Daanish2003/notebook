# How the Bot SDK can use Notebook

Type: research
Status: open
Blocked by:

## Question

The Owner's Bot SDK app (`~/hobby/bot-sdk`, read-only for this research) should let a Bot use Notebook: add a Source by link, check a Transcription, search the Library, and read a Transcript with timestamps. From its code, `CONTEXT.md` and `docs/adr/`, what are the integration points?

- Can a Host offer a Connection whose tools come from an arbitrary MCP server (URL plus token)? How does ADR 0037 ("connection tokens come from the Host") apply, and what would a "Notebook" Connection need: streamable HTTP or SSE, auth header, per-user scoping?
- Could a Bot Skill on the user's Computer call a `notebook` CLI instead? What are the trade-offs?
- How do tool results of transcript size (~13k tokens) fit their Turn and context handling?
- Do they already use an MCP client library or SDK version we should match?

Also: what's the current best practice for a small TypeScript MCP server on Hono/Bun (official `@modelcontextprotocol/sdk` streamable HTTP transport, version and dates), and how Claude Code consumes the same server (`.mcp.json` / `claude mcp add --transport http`)? Cite file paths in bot-sdk and URLs for external docs.
