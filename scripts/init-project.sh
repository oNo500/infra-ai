#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATES_DIR="$REPO_ROOT/templates"

usage() {
  echo "Usage: $0 <target-dir> [--type ts-node|python|generic]"
  exit 1
}

confirm_overwrite() {
  local file="$1"
  echo "$file already exists. Overwrite? [y/N] "
  read -r reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

copy_if_safe() {
  local src="$1"
  local dst="$2"
  if [[ -f "$dst" ]]; then
    confirm_overwrite "$dst" || { echo "Skipping $dst"; return; }
  fi
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
  echo "  wrote $dst"
}

# Parse args
TARGET=""
TYPE="generic"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --type) TYPE="$2"; shift 2 ;;
    --help|-h) usage ;;
    -*) echo "Unknown option: $1"; usage ;;
    *) TARGET="$1"; shift ;;
  esac
done

[[ -z "$TARGET" ]] && usage

TARGET="$(cd "$TARGET" 2>/dev/null && pwd || { mkdir -p "$TARGET" && cd "$TARGET" && pwd; })"

echo "Initializing Claude Code config in: $TARGET"
echo "Type: $TYPE"
echo ""

copy_if_safe "$TEMPLATES_DIR/settings.json" "$TARGET/.claude/settings.json"
copy_if_safe "$TEMPLATES_DIR/CLAUDE.md" "$TARGET/CLAUDE.md"

echo ""
echo "Done. Next steps:"
echo "  1. Fill in project name and commands in CLAUDE.md"
echo "  2. Add hook scripts to .claude/hooks/ and register them in .claude/settings.json"
echo "  3. Run: pnpx skills add $(dirname "$REPO_ROOT")/infra-ai"
