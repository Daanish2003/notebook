#!/usr/bin/env bash
# The exact `claude -p` calls made in the experiments, run from the decoy dir.
# Usage: cd "$T" && bash run-claude.sh <structured|qa|tooltrap|badmodel|timeout|control>
set -u
ISO=(--tools "" --strict-mcp-config --setting-sources "" --safe-mode
     --disable-slash-commands --no-session-persistence)
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
s=$EPOCHREALTIME
case "$1" in
  structured) # stream-json so the system/init event (tools, MCP, plugins) is visible
    claude -p --model sonnet --output-format stream-json --verbose \
      --json-schema "$(cat schema.json)" --system-prompt-file system.txt "${ISO[@]}" \
      < prompt-structured.txt > claude-structured.jsonl 2> claude-structured.err ;;
  qa) # also run with a stripped env and no controlling terminal, like a systemd unit
    env $(env | cut -d= -f1 | grep -vxE 'HOME' | sed 's/^/-u /') PATH=/usr/bin:/bin \
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
      setsid -w "$HOME/.local/share/mise/installs/claude/latest/claude" -p --model sonnet \
      --output-format json --system-prompt-file system.txt "${ISO[@]}" --max-turns 1 \
      < prompt-qa.txt > claude-qa.json 2> claude-qa.err ;;
  tooltrap)
    claude -p --model sonnet --output-format json --system-prompt-file system.txt \
      "${ISO[@]}" --max-turns 2 < prompt-tooltrap.txt > claude-tooltrap.json 2> claude-tooltrap.err ;;
  badmodel)
    echo hi | claude -p --model claude-nope-9 --output-format json "${ISO[@]}" --max-turns 1 \
      > claude-badmodel.json 2> claude-badmodel.err ;;
  timeout)
    timeout 3 claude -p --model sonnet --output-format json --system-prompt-file system.txt \
      "${ISO[@]}" --max-turns 2 --json-schema "$(cat schema.json)" \
      < prompt-structured.txt > claude-timeout.json 2> claude-timeout.err ;;
  control) # NO isolation flags: shows what leaks in by default
    echo "Say hi in three words." | claude -p --model haiku --output-format stream-json \
      --verbose --no-session-persistence --max-turns 1 > claude-control.jsonl 2> claude-control.err ;;
esac
echo "exit=$? wall=$(python3 -c "print(round($EPOCHREALTIME-$s,2))")"
