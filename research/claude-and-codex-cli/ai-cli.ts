// Sketch: call `claude -p` or `codex exec` from Bun as a pure text-in/JSON-out
// completion, with a timeout and failure classification. Research artefact,
// not production code. Tested here only on the bad-model and timeout paths:
//   bun ai-cli.ts claude badmodel | bun ai-cli.ts codex timeout
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

export type Provider = "claude" | "codex";
export type Failure =
  | "timeout"
  | "logged_out"
  | "usage_limit" // plan session/weekly limit: wait for reset
  | "rate_limited" // 429/529/overloaded: retry later
  | "bad_model"
  | "cli_changed" // unknown flag / unparseable output after an update
  | "no_structured_output"
  | "unknown";
export type AiResult =
  | { ok: true; json: unknown; text: string; ms: number; raw: unknown }
  | { ok: false; failure: Failure; message: string; ms: number; exitCode: number | null };

const HOME = homedir();
// Real binaries, not the mise shims (a systemd unit's PATH has no mise).
const BIN = {
  claude: `${HOME}/.local/share/mise/installs/claude/latest/claude`,
  codex: `${HOME}/.local/share/mise/installs/codex/latest/bin/codex`,
};
// An empty dir no repo config can reach (no CLAUDE.md/AGENTS.md/.mcp.json/hooks).
const CWD = join(process.env.XDG_RUNTIME_DIR ?? tmpdir(), "notebook-ai");

const AUTH_RE =
  /not logged in|please run \/login|login expired|reached its time limit|oauth token|failed to authenticate|invalid authentication|could not resolve authentication|401|unauthorized|codex login|sign in again/i;
const LIMIT_RE =
  /hit your (session|weekly|opus|sonnet) limit|usage limit|usage credits|credit balance|you've hit your|limit reached|try again (at|in)|purchase more credits/i;
const RATE_RE = /429|529|rate.?limit|overloaded|temporarily limiting|high load|too many requests/i;
const MODEL_RE =
  /issue with the selected model|not a recognized model|model .* not found|model is not supported|unrecognized_model/i;

function classify(text: string): Failure {
  if (MODEL_RE.test(text)) return "bad_model";
  if (LIMIT_RE.test(text)) return "usage_limit";
  if (AUTH_RE.test(text)) return "logged_out";
  if (RATE_RE.test(text)) return "rate_limited";
  if (/unknown option|unexpected argument|unrecognized/i.test(text)) return "cli_changed";
  return "unknown";
}

function args(
  p: Provider,
  model: string,
  systemFile: string,
  schemaFile?: string,
  outFile?: string,
) {
  if (p === "claude") {
    return [
      "-p",
      "--model",
      model,
      "--output-format",
      "json",
      "--system-prompt-file",
      systemFile,
      "--tools",
      "",
      "--strict-mcp-config",
      "--setting-sources",
      "",
      "--safe-mode",
      "--disable-slash-commands",
      "--no-session-persistence",
      "--max-turns",
      schemaFile ? "2" : "1", // StructuredOutput takes a 2nd turn
      ...(schemaFile ? ["--json-schema", readFileSync(schemaFile, "utf8")] : []),
    ];
  }
  return [
    "exec",
    "--json",
    "--ephemeral",
    "--skip-git-repo-check",
    "--ignore-user-config",
    "--ignore-rules",
    "-s",
    "read-only",
    "-c",
    'approval_policy="never"',
    "-c",
    'web_search="disabled"',
    "-c",
    "project_doc_max_bytes=0",
    "-c",
    `model_instructions_file="${systemFile}"`,
    "-c",
    'model_reasoning_effort="low"',
    "-c",
    "skills.include_instructions=false",
    "-c",
    "skills.bundled.enabled=false",
    "-c",
    "agents.enabled=false",
    ...[
      "shell_tool",
      "unified_exec",
      "view_image",
      "multi_agent",
      "apps",
      "hooks",
      "plugins",
      "image_generation",
      "browser_use",
      "computer_use",
      "goals",
    ].flatMap((f) => ["--disable", f]),
    "-m",
    model,
    "-o",
    outFile!,
    ...(schemaFile ? ["--output-schema", schemaFile] : []),
    "-", // prompt from stdin
  ];
}

export async function runAi(opts: {
  provider: Provider;
  model: string;
  system: string;
  prompt: string;
  schema?: object;
  timeoutMs?: number;
}): Promise<AiResult> {
  mkdirSync(CWD, { recursive: true, mode: 0o700 });
  const work = mkdtempSync(join(CWD, "call-")); // per-call files; cwd stays CWD
  const systemFile = join(work, "system.txt");
  writeFileSync(systemFile, opts.system);
  const schemaFile = opts.schema ? join(work, "schema.json") : undefined;
  if (schemaFile) writeFileSync(schemaFile, JSON.stringify(opts.schema));
  const outFile = join(work, "last.txt");
  const started = performance.now();
  try {
    const proc = Bun.spawn(
      [BIN[opts.provider], ...args(opts.provider, opts.model, systemFile, schemaFile, outFile)],
      {
        cwd: CWD,
        // Minimal env like a systemd user unit; HOME is what finds the credentials.
        env: {
          HOME,
          PATH: "/usr/bin:/bin",
          LANG: "C.UTF-8",
          CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
        },
        stdin: new Blob([opts.prompt]),
        stdout: "pipe",
        stderr: "pipe",
        timeout: opts.timeoutMs ?? 120_000,
        killSignal: "SIGTERM",
      },
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    const ms = Math.round(performance.now() - started);
    if (proc.signalCode === "SIGTERM" || exitCode === 143) {
      return { ok: false, failure: "timeout", message: `killed after ${ms} ms`, ms, exitCode };
    }
    if (opts.provider === "claude") {
      let r: any;
      try {
        r = JSON.parse(stdout);
      } catch {
        return {
          ok: false,
          failure: classify(stderr) === "unknown" ? "cli_changed" : classify(stderr),
          message: (stderr || stdout).slice(0, 500),
          ms,
          exitCode,
        };
      }
      if (r.is_error || exitCode !== 0) {
        const msg = `${r.api_error_status ?? ""} ${r.result ?? ""} ${stderr}`;
        return {
          ok: false,
          failure: classify(msg),
          message: msg.trim().slice(0, 500),
          ms,
          exitCode,
        };
      }
      if (opts.schema && r.structured_output === undefined) {
        return {
          ok: false,
          failure: "no_structured_output",
          message: String(r.result).slice(0, 500),
          ms,
          exitCode,
        };
      }
      return { ok: true, json: r.structured_output ?? null, text: r.result, ms, raw: r };
    }
    // codex: JSONL events on stdout; errors as {type:"error"} / {type:"turn.failed"}
    const events = stdout
      .split("\n")
      .filter(Boolean)
      .flatMap((l) => {
        try {
          return [JSON.parse(l)];
        } catch {
          return [];
        }
      });
    const failed =
      events.find((e) => e.type === "turn.failed") ?? events.find((e) => e.type === "error");
    if (failed || exitCode !== 0) {
      const msg = `${failed?.error?.message ?? failed?.message ?? ""} ${stderr.replace(/^warning: Untrusted.*$/m, "")}`;
      return {
        ok: false,
        failure: events.length
          ? classify(msg)
          : classify(msg) === "unknown"
            ? "cli_changed"
            : classify(msg),
        message: msg.trim().slice(0, 500),
        ms,
        exitCode,
      };
    }
    const text = readFileSync(outFile, "utf8");
    let json: unknown = null;
    if (opts.schema) {
      try {
        json = JSON.parse(text);
      } catch {
        return {
          ok: false,
          failure: "no_structured_output",
          message: text.slice(0, 500),
          ms,
          exitCode,
        };
      }
    }
    return { ok: true, json, text, ms, raw: events };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const [provider, mode] = process.argv.slice(2) as [Provider, string];
  const model = mode === "badmodel" ? "nope-9" : provider === "claude" ? "sonnet" : "gpt-6-luna";
  const res = await runAi({
    provider,
    model,
    system: "Answer briefly.",
    prompt: "Write three paragraphs about sorting algorithms.",
    schema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] },
    timeoutMs: mode === "timeout" ? 1500 : 60_000,
  });
  console.log(JSON.stringify(res.ok ? { ok: true, ms: res.ms, json: res.json } : res));
}
