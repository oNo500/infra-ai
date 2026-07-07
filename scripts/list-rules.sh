#!/usr/bin/env bash
# Reconcile rule meta sources (meta/rules/ frontmatter) against build artifacts (rules/).
# SSoT is frontmatter; no intermediate JSON — see
# docs/superpowers/specs/2026-07-06-rules-ledger-tooling-design.md

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

python3 - "$REPO_ROOT" <<'EOF'
import glob
import os
import re
import sys

root = sys.argv[1]
meta_dir = os.path.join(root, "meta", "rules")


def parse_frontmatter(path):
    fm = {}
    with open(path) as f:
        lines = f.read().splitlines()
    if not lines or lines[0].strip() != "---":
        return fm
    for line in lines[1:]:
        if line.strip() == "---":
            break
        m = re.match(r"^([A-Za-z][\w-]*):\s*(.*)$", line)
        if m:
            fm[m.group(1)] = m.group(2).strip().strip('"')
    return fm


def artifact_state(name, scope):
    if scope == "global":
        candidates = [os.path.join("rules", "global", name + ".md")]
    elif scope:
        candidates = [os.path.join("rules", "scoped", name + ".md")]
    else:
        # scope 未声明：产物可能在任一子目录
        candidates = [
            os.path.join("rules", sub, name + ".md") for sub in ("global", "scoped")
        ]
    hits = [c for c in candidates if os.path.exists(os.path.join(root, c))]
    return "已构建 " + hits[0] if hits else "未构建"


rows = []
for path in sorted(glob.glob(os.path.join(meta_dir, "*.md"))):
    fm = parse_frontmatter(path)
    name = fm.get("name", os.path.splitext(os.path.basename(path))[0])
    status = fm.get("status", "?")
    scope = fm.get("scope", "")
    rows.append((name, status, scope or "未声明", artifact_state(name, scope)))

if not rows:
    print("meta/rules/ 为空")
    sys.exit(0)

w_name = max(len(r[0]) for r in rows)
w_status = max(len(r[1]) for r in rows)
w_scope = max(len(r[2]) for r in rows)
for name, status, scope, built in rows:
    print(f"  {name:<{w_name}}  {status:<{w_status}}  scope:{scope:<{w_scope}}  {built}")
EOF
