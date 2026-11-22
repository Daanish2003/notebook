#!/usr/bin/env bash
# PostToolUse hook: lint-fix + format the file Claude just edited/wrote.
# Remaining lint errors are fed back to Claude (exit 2) so it fixes them.
set -uo pipefail

file=$(jq -r '.tool_input.file_path // empty')
[[ -z "$file" || ! -f "$file" ]] && exit 0

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}" || exit 0

case "$file" in
  */node_modules/* | */.claude/skills/* | *.gen.ts | */src/env.ts) exit 0 ;;
esac

case "$file" in
  *.js | *.jsx | *.ts | *.tsx | *.mjs | *.cjs | *.mts | *.cts)
    out=$(pnpm exec oxlint --fix "$file" 2>&1)
    status=$?
    pnpm exec oxfmt --write "$file" >/dev/null 2>&1
    if [[ $status -ne 0 ]]; then
      echo "oxlint errors in $file:" >&2
      echo "$out" >&2
      exit 2
    fi
    ;;
  *.json | *.jsonc | *.css | *.md | *.yml | *.yaml)
    pnpm exec oxfmt --write --no-error-on-unmatched-pattern "$file" >/dev/null 2>&1
    ;;
esac
exit 0
