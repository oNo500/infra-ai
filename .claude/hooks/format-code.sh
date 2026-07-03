#!/usr/bin/env bash
# PostToolUse hook: auto-format written files by extension.
set -euo pipefail

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  exit 0
fi

case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx)
    npx prettier --write "$FILE" 2>/dev/null || true
    npx eslint --fix "$FILE" 2>/dev/null || true
    ;;
  *.py)
    python -m black "$FILE" 2>/dev/null || true
    ;;
esac

# PostToolUse must always exit 0 — non-zero is a non-blocking warning only.
exit 0
