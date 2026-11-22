#!/usr/bin/env bash
# Run one isolated `codex exec` call from the current (temp) directory.
# Usage: bash run-codex.sh <name> <prompt-file> [schema|noschema] [model] [extra args...]
# Writes <name>.jsonl (events), <name>.err (stderr), <name>.last (final message).
set -u
name="$1"; prompt="$2"; schema="${3:-noschema}"; model="${4:-gpt-6-luna}"
shift 4 2>/dev/null || shift $#
args=(
  exec --json --ephemeral --skip-git-repo-check
  --ignore-user-config --ignore-rules
  -s read-only
  -c 'approval_policy="never"'
  -c 'web_search="disabled"'
  -c 'project_doc_max_bytes=0'
  -c "model_instructions_file=\"$PWD/system.txt\""
  -c 'model_reasoning_effort="low"'
  --disable shell_tool --disable unified_exec --disable view_image
  --disable multi_agent --disable apps --disable hooks
)
# LEAN=1 (added after the first runs): also drop the skills catalog and
# multi-agent instructions that `codex debug prompt-input` showed were still
# in the model context (~17.8 KB of skills text).
[ "${LEAN:-0}" = 1 ] && args+=(
  -c 'skills.include_instructions=false' -c 'skills.bundled.enabled=false'
  -c 'agents.enabled=false'
  --disable plugins --disable image_generation --disable browser_use
  --disable computer_use --disable goals
)
args+=(
  -m "$model"
  -o "$name.last"
)
[ "$schema" = schema ] && args+=(--output-schema schema.json)
s=$EPOCHREALTIME
"${CODEX:-codex}" "${args[@]}" "$@" - < "$prompt" > "$name.jsonl" 2> "$name.err"
rc=$?
echo "exit=$rc wall=$(python3 -c "print(round($EPOCHREALTIME-$s,2))")"
