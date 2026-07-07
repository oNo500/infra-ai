# Rules 账实对账工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 不建 rules.json（删除草稿），以 `scripts/list-rules.sh` + `make list-rules` 直接扫 `meta/rules/` frontmatter 与 `rules/` 产物目录做账实对账。

**Architecture:** SSoT 是 `meta/rules/*.md` 的 frontmatter（`name/status/scope`），工具只读不写、无中间 JSON。脚本用 bash 外壳 + 内嵌 python3 解析 frontmatter（与 `scripts/list-skills.sh` 同构），按 `scope` 推算产物落点（`rules/global/` 或 `rules/scoped/`）并标注已构建/未构建。

**Tech Stack:** bash + python3 标准库（无 PyYAML 依赖，手工解析简单 `key: value` frontmatter）、Makefile。

**Spec:** `docs/superpowers/specs/2026-07-06-rules-ledger-tooling-design.md`

## Global Constraints

- 源代码禁止 emoji；commit message 英文、Conventional Commits 格式
- 不引入任何 JSON 中间层；不做构建/分发脚本
- 不列 `.claude/rules/` 自用文件
- 脚本风格对齐 `scripts/list-skills.sh`（`set -euo pipefail`、内嵌 python3 heredoc）
- 仓库无测试框架，验证方式为运行脚本核对输出（现状：meta/rules/ 有 python、readme-rule、typescript 三个 stub，均无 scope 字段，rules/ 目录为空）

---

### Task 1: list-rules 脚本 + Makefile 目标 + 删除 rules.json 草稿

**Files:**
- Create: `scripts/list-rules.sh`
- Modify: `Makefile:1`（.PHONY 行）与文件末尾（新增 target）
- Delete: `rules.json`（未跟踪草稿，直接 rm，无需 git rm）

**Interfaces:**
- Consumes: `meta/rules/*.md` frontmatter 字段 `name`、`status`（stub/ready）、`scope`（`global` 或带引号的 glob，可能缺失）；产物目录 `rules/global/`、`rules/scoped/`
- Produces: `make list-rules` 输出每条 rule 一行：name、status、scope（缺失显示「未声明」）、产物状态（`已构建 <路径>` 或 `未构建`）

- [x] **Step 1: 写脚本 `scripts/list-rules.sh`**

```bash
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
```

- [x] **Step 2: 赋执行权限并运行**

Run: `chmod +x scripts/list-rules.sh && scripts/list-rules.sh`

Expected（当前仓库状态：三个 stub、无 scope、rules/ 为空）:

```
  python       stub  scope:未声明  未构建
  readme-rule  stub  scope:未声明  未构建
  typescript   stub  scope:未声明  未构建
```

- [x] **Step 3: 边界验证——scope 与产物对账逻辑**

临时给一个 stub 加 scope 并放一个假产物，确认推算与对账正确，验完还原：

Run:

```bash
mkdir -p rules/global
printf -- '---\npaths: none\n---\nplaceholder\n' > rules/global/python.md
sed -i '' 's/^status: stub$/status: stub\nscope: global/' meta/rules/python.md
scripts/list-rules.sh
```

Expected: python 行变为 `python  stub  scope:global  已构建 rules/global/python.md`，其余两行不变。

Run（还原）:

```bash
git checkout -- meta/rules/python.md
rm rules/global/python.md
rmdir rules/global rules 2>/dev/null || true
scripts/list-rules.sh
```

Expected: 恢复 Step 2 的输出。

- [x] **Step 4: Makefile 加 list-rules 目标**

修改 `Makefile` 第 1 行：

```makefile
.PHONY: help check sync list list-rules
```

文件末尾追加：

```makefile
list-rules: ## Reconcile rule meta sources against build artifacts
	@scripts/list-rules.sh
```

Run: `make list-rules`
Expected: 与 Step 2 输出一致；`make help` 中出现 `list-rules` 行。

- [x] **Step 5: 删除 rules.json 草稿**

Run: `rm rules.json && git status --short`
Expected: 输出中不再有 `?? rules.json`。

- [x] **Step 6: Commit**

```bash
git add scripts/list-rules.sh Makefile
git commit -m "feat(rules): add list-rules reconciliation over meta frontmatter"
```

注意：只提交本任务的两个文件；工作区里 `skills.json`、`scripts/list-skills.sh` 的既有改动属于上一项工作，不混入。
