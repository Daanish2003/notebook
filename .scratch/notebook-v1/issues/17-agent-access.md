# Agent access: CLI, Claude Code skill, MCP

Type: grilling
Status: resolved
Blocked by: 16

## Question

How do agents use Notebook? Given "How the Bot SDK can use Notebook", settle:

- **Surfaces:** a `notebook` CLI, a Claude Code skill, and an MCP server on the Notebook server. Which to build, and for whom.
- **Tool set:** which operations are exposed (add Source by URL or file, status, search with timestamped hits, get Transcript in Markdown or JSON, list recent, Tags, Export) and their exact shapes. Transcript reads must be paginated or ranged so a long one doesn't flood an agent's context.
- **Auth for non-browser clients**, which amends ADR 0001: a per-client bearer token over the tailnet? How it's issued, stored and revoked, and how the multi-user Bot SDK keeps the Notebook Connection to the Owner's account only.
- **Writes:** whether agents may add, edit or delete, or only read and add.
- **Claude Code skill:** where it lives (`~/.claude/skills/notebook` or a plugin), and its description wording so it triggers on "transcribe this link" or "what did that talk say about…".
- **Effect on "AI reading help":** does Q&A move to agents, leaving the in-app AI to summaries?

## Answer

Decided with the Owner (grilling, 2026-11-22; recommendations accepted), building on "How the Bot SDK can use Notebook".

1. **Surfaces:** one stateless MCP endpoint, `POST /mcp`, in the Notebook Hono process (`@modelcontextprotocol/server` `createMcpHandler`), used by both Claude Code and the Bot SDK. A small Claude Code skill guides use of those tools. There is no `notebook` CLI in v1.
2. **Tools:**
   - Read:
     - `search` (hits with Source, Segment, timestamp, excerpt)
     - `list_recent`
     - `get_source` (metadata plus an outline of chapters or paragraph starts)
     - `get_transcript` (`fromMs`/`toMs` or a cursor; pages of 8,000 characters or less; Markdown with `[mm:ss]` stamps, or Segment JSON)
     - `get_status`
     - `list_tags`
   - Write: only `add_source { url, tags? }`, idempotent on the normalised URL (returns the existing Source).
   - Not exposed: editing, deleting, Export and file uploads.
3. **Agent tokens:** `/mcp` requires a bearer token per client, named and revocable from a small Settings page and stored hashed (an `agent_token` table). Every `/mcp` request is also checked for Host/Origin. The PWA stays login-free. This amends ADR 0001; see ADR 0003.
4. **Bot SDK blocker:** fixed in the bot-sdk repo with a per-Connection `privateNetwork: true` opt-in in `@botsdk/mcp`, plus a bot-sdk ADR 0037 amendment, so the tools are defined once. That change belongs to the bot-sdk repo (see Out of scope); this map only records the dependency.
5. **Scoping in the Bot SDK:** the Host's `connection(userId, "notebook")` hook returns the Notebook token only for the Owner's user id, and the Notebook row in Settings is hidden from everyone else. The Bot SDK runs on omarchy, which is on the tailnet.
6. **Approvals:** read tools are `approvalFree` and marked read-only (`readOnlyHint`), so read-only runs can use them. `add_source` stays Auto-reviewed.
7. **Claude Code skill:** its source lives in `agents/claude-skill/notebook/`, and `pnpm deploy:local` installs it to `~/.claude/skills/notebook`. Its description triggers on "transcribe this link", "what did that talk/lecture/podcast say about…", and "my notebook". The MCP server is registered once with `claude mcp add --transport http notebook https://omarchy.<tailnet>.ts.net/mcp --scope user --header "Authorization: Bearer …"`.
8. **Resource:** `notebook://source/{id}/transcript`, for `@` mentions in Claude Code. The Bot SDK ignores resources.
9. **Effect on "AI reading help":** Q&A moves to agents. In-app AI covers only generated reader content: summary, chapters and key points.
