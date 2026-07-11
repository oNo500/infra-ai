#!/usr/bin/env bash
# List installed skills (via pnpx skills) + curated recommendations from skills.json.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILLS_JSON="$SCRIPT_DIR/../skills.json"

# ── installed ─────────────────────────────────────────────────────────────────

echo "已安装"
echo "──────"
pnpx skills ls 2>&1

# ── recommended ───────────────────────────────────────────────────────────────

echo ""
echo "精选推荐"
echo "────────"
python3 - "$SKILLS_JSON" <<'EOF'
import sys, json

with open(sys.argv[1]) as f:
    ledger = json.load(f)

for s in ledger:
    if s.get("source") == "official":
        name = s["name"]
        repo = s.get("repo", "")
        print(f"  {name:<32} pnpx skills add {repo}")
EOF
