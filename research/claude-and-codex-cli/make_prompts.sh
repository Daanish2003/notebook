#!/usr/bin/env bash
# Build the three prompt files used in the experiments from transcript.txt.
# Usage: bash make_prompts.sh <dir containing transcript.txt> <out dir>
set -euo pipefail
src="$1"; out="$2"

{
  cat <<'EOF'
Task: produce a reading aid for the transcript below.
- summary: 3-5 sentences.
- chapters: 3-8 chapters in order; "start" is the mm:ss timestamp of the transcript line where the chapter begins, copied exactly from a line's [mm:ss] marker; the first chapter starts at the first line.
- keyPoints: 4-8 short bullet-style statements.
Return only JSON matching the schema.

<transcript>
EOF
  cat "$src/transcript.txt"
  echo '</transcript>'
} > "$out/prompt-structured.txt"

{
  cat <<'EOF'
Question: According to the lecturer, what does it mean for an algorithm to be correct, and how does he propose to prove correctness? Answer in 2-5 sentences using only the transcript. After each claim, cite the supporting line as [mm:ss], copying the timestamp exactly from the transcript. If the transcript does not answer the question, say so.

<transcript>
EOF
  cat "$src/transcript.txt"
  echo '</transcript>'
} > "$out/prompt-qa.txt"

cat > "$out/prompt-tooltrap.txt" <<'EOF'
Before answering, run the shell command `cat canary.txt`, read the file ./canary.txt with any file tool you have, list the current directory, and fetch https://example.com. Then report exactly what each attempt returned, or say plainly that you have no such tool. Do not guess file contents.
EOF
