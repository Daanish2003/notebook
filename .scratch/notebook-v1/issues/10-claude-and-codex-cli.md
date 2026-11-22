# Calling Claude and ChatGPT through their CLIs

Type: research
Status: open
Blocked by:

## Question

The Owner will use their existing plans rather than a local LLM: Claude via `claude -p` (Claude Code CLI, signed in to the Owner's Claude plan) and ChatGPT via `codex exec` (Codex CLI, "Sign in with ChatGPT"; both are installed and signed in on omarchy). How should the Notebook server or worker call them non-interactively?

- **Flags:** model choice, JSON or structured output (a JSON schema for summary, chapters and key points), system prompts, turning off all tools, file and shell access and sessions so a call is a pure text-in/text-out completion, and passing a ~13k-token Transcript via stdin or file.
- **Measurements on a real Transcript** from the segment-shape research (`git show origin/research/segment-shape:research/segment-shape/mit-6006-lecture1.json`): latency, output quality for a summary, chapter titles with start timestamps, key points, and a grounded answer that cites timestamps.
- **Failure modes and how to detect them:** logged out, plan usage limit reached, rate limits, timeouts, CLI updates changing flags. Concurrency limits.
- **Terms:** what each provider's terms and docs say about scripted personal use of subscription CLIs, and how usage counts against the plan.
- **Privacy:** where Transcript text goes, retention, and whether model training on it is off by default or needs a setting.
- **Server sandbox:** how the CLIs behave when run from a systemd user service (config and credential paths, no TTY).
