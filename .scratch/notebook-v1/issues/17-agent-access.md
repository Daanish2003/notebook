# Agent access: CLI, Claude Code skill, MCP

Type: grilling
Status: open
Blocked by: 16

## Question

How do agents use Notebook? Given "How the Bot SDK can use Notebook", settle:

- **Surfaces:** a `notebook` CLI, a Claude Code skill, and an MCP server on the Notebook server. Which to build, and for whom.
- **Tool set:** which operations are exposed (add Source by URL or file, status, search with timestamped hits, get Transcript in Markdown or JSON, list recent, Tags, Export) and their exact shapes. Transcript reads must be paginated or ranged so a long one doesn't flood an agent's context.
- **Auth for non-browser clients**, which amends ADR 0001: a per-client bearer token over the tailnet? How it's issued, stored and revoked, and how the multi-user Bot SDK keeps the Notebook Connection to the Owner's account only.
- **Writes:** whether agents may add, edit or delete, or only read and add.
- **Claude Code skill:** where it lives (`~/.claude/skills/notebook` or a plugin), and its description wording so it triggers on "transcribe this link" or "what did that talk say about…".
- **Effect on "AI reading help":** does Q&A move to agents, leaving the in-app AI to summaries?
