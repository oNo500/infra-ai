#!/usr/bin/env bash
set -euo pipefail

SKILLS_FILE="$(dirname "$0")/../skills.json"
SKILLS_DIR="$(dirname "$0")/../skills"

run() {
  local mode="$1"
  local fail=0

  for skill_md in "$SKILLS_DIR"/*/SKILL.md; do
    [[ -f "$skill_md" ]] || continue
    local dir fm_name
    dir=$(basename "$(dirname "$skill_md")")
    fm_name=$(awk '/^---$/{f++; next} f==1 && sub(/^name:[[:space:]]*/, "") {print; exit}' "$skill_md")

    if [[ "$fm_name" != "$dir" ]]; then
      echo "[error] $dir: frontmatter name '$fm_name' != directory name"
      fail=1
      continue
    fi

    if jq -e --arg n "$dir" 'map(select(.name == $n)) | length > 0' "$SKILLS_FILE" >/dev/null; then
      echo "[ok] $dir"
      continue
    fi

    if [[ "$mode" == "check" ]]; then
      echo "[unledgered] $dir: missing from skills.json"
      fail=1
    else
      local tmp
      tmp=$(mktemp)
      jq --arg n "$dir" '. + [{ "name": $n, "source": "custom" }]' "$SKILLS_FILE" > "$tmp"
      mv "$tmp" "$SKILLS_FILE"
      echo "[added] $dir (source: custom)"
    fi
  done

  return $fail
}

case "${1:-}" in
  check) run check ;;
  fix)   run fix ;;
  *)
    echo "usage: check-ledger.sh <check|fix>"
    exit 1
    ;;
esac
