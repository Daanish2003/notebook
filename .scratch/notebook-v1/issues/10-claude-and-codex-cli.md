# Calling Claude and ChatGPT through their CLIs

Type: research
Status: resolved
Blocked by:

## Question

The Owner will use their existing plans rather than a local LLM: Claude via `claude -p` (Claude Code CLI, signed in to the Owner's Claude plan) and ChatGPT via `codex exec` (Codex CLI, "Sign in with ChatGPT"; both are installed and signed in on omarchy). How should the Notebook server or worker call them non-interactively?

- **Flags:** model choice, JSON or structured output (a JSON schema for summary, chapters and key points), system prompts, turning off all tools, file and shell access and sessions so a call is a pure text-in/text-out completion, and passing a ~13k-token Transcript via stdin or file.
- **Measurements on a real Transcript** from the segment-shape research (`git show origin/research/segment-shape:research/segment-shape/mit-6006-lecture1.json`): latency, output quality for a summary, chapter titles with start timestamps, key points, and a grounded answer that cites timestamps.
- **Failure modes and how to detect them:** logged out, plan usage limit reached, rate limits, timeouts, CLI updates changing flags. Concurrency limits.
- **Terms:** what each provider's terms and docs say about scripted personal use of subscription CLIs, and how usage counts against the plan.
- **Privacy:** where Transcript text goes, retention, and whether model training on it is off by default or needs a setting.
- **Server sandbox:** how the CLIs behave when run from a systemd user service (config and credential paths, no TTY).

## Answer

Research: [`research/claude-and-codex-cli.md` on branch `research/claude-and-codex-cli`](https://github.com/Daanish2003/notebook/blob/research/claude-and-codex-cli/research/claude-and-codex-cli.md). Includes exact invocations, samples, and a Bun `ai-cli.ts` sketch with failure classification.

- **Both work as isolated, tool-less JSON completions** with the prompt on stdin.
  - Claude (`sonnet`, `--json-schema`): structured output in about 6 s, and Q&A with 5/5 correct timestamp citations.
  - Codex (`gpt-6-luna`, low effort, `--output-schema`): 8–10 s, slightly less careful (it repeated a misheard name as fact). It needs about 20 flags to turn off tools, skills and the user config.
  - Claude is the better default.
- **Isolation flags are mandatory.** Un-isolated, `claude -p` ran a folder's hooks, MCP servers and CLAUDE.md. With the recommended flags, nothing leaked for either CLI. Run from an empty directory such as `$XDG_RUNTIME_DIR/notebook-ai`, call the real binaries by absolute path (not the mise wrappers), and set a minimal env. Both work without a TTY.
- **Failures:**
  - Classify bad model, timeout and changed flags by exit code and JSON fields. Claude's `subtype` can say "success" on an error; use `is_error`.
  - Logged-out and usage-limit messages are documented for Claude but untested; undocumented for Codex.
  - Check auth first without spending usage: `claude auth status --json` (never log it whole) and `codex login status`.
- **Claude login expiry:** the CLI login expires around 2026-11-27 to 30, and use doesn't extend it. Unattended use needs `claude setup-token`, a one-year token (untested under systemd).
- **Risks:**
  - The Claude docs say `--bare` will become the default for `-p`, and bare mode ignores subscription logins.
  - mise pins both CLIs to `latest`, so flags drift. Run a smoke test after upgrades.
- **Terms are grey for both.** Owner-triggered, on-demand calls are the defensible pattern; automatically processing every Source is not.
- **Privacy:** with `--no-session-persistence` and `--ephemeral`, no Transcript text stays local. Training depends on account settings: OpenAI may train unless turned off, and Anthropic's default couldn't be confirmed.
- **Not verified:** a full 45-minute Transcript (tests used about 2k tokens), and concurrency.
