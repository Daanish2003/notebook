# Agents reach Notebook through MCP with a bearer token

Amends ADR 0001. The PWA stays login-free behind the tailnet, but the MCP endpoint (`POST /mcp`) also requires a per-client bearer token, created and revoked in Notebook's Settings and stored hashed. The Bot SDK is multi-user and runs Bots that act on their own, so the tailnet alone can't say _which_ client is asking, or let the Owner cut one off. A token per client (Claude Code, the Bot SDK) does both, and the Bot SDK hands it only to the Owner's user. Agents can read and add Sources, never edit, delete or export.
