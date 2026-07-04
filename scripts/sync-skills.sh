#!/usr/bin/env bash
set -euo pipefail

MIRRORS_FILE="$(dirname "$0")/../mirrors.json"
SKILLS_DIR="$(dirname "$0")/../skills"

check() {
  local has_updates=0
  local count
  count=$(jq 'length' "$MIRRORS_FILE")

  for i in $(seq 0 $((count - 1))); do
    local name repo path local_commit remote_commit
    name=$(jq -r ".[$i].name" "$MIRRORS_FILE")
    repo=$(jq -r ".[$i].repo" "$MIRRORS_FILE")
    path=$(jq -r ".[$i].path" "$MIRRORS_FILE")
    local_commit=$(jq -r ".[$i].commit" "$MIRRORS_FILE")
    remote_commit=$(gh api "repos/${repo}/commits?path=${path}" --jq '.[0].sha')

    if [[ "$local_commit" != "$remote_commit" ]]; then
      echo "[outdated] $name: $local_commit -> $remote_commit"
      has_updates=1
    else
      echo "[up-to-date] $name"
    fi
  done

  return $has_updates
}

update() {
  local count
  count=$(jq 'length' "$MIRRORS_FILE")
  local today
  today=$(date '+%Y-%m-%d')

  for i in $(seq 0 $((count - 1))); do
    local name repo path local_commit remote_commit
    name=$(jq -r ".[$i].name" "$MIRRORS_FILE")
    repo=$(jq -r ".[$i].repo" "$MIRRORS_FILE")
    path=$(jq -r ".[$i].path" "$MIRRORS_FILE")
    local_commit=$(jq -r ".[$i].commit" "$MIRRORS_FILE")
    remote_commit=$(gh api "repos/${repo}/commits?path=${path}" --jq '.[0].sha')

    if [[ "$local_commit" == "$remote_commit" ]]; then
      echo "[skip] $name is up-to-date"
      continue
    fi

    echo "[update] $name ..."
    pnpx giget "gh:${repo}/${path}" "${SKILLS_DIR}/${name}" --force

    local tmp
    tmp=$(mktemp)
    jq ".[$i].commit = \"$remote_commit\" | .[$i].updated = \"$today\"" "$MIRRORS_FILE" > "$tmp"
    mv "$tmp" "$MIRRORS_FILE"
    echo "[done] $name -> $remote_commit"
  done
}

case "${1:-}" in
  check)  check ;;
  update) update ;;
  *)
    echo "usage: sync-skills.sh <check|update>"
    exit 1
    ;;
esac
