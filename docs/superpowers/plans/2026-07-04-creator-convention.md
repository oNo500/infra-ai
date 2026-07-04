# Creator 执行约定与账目对账 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 `creator/` 元指令补执行约定文档，并用幂等脚本保证 `skills.json` 上账（spec: `docs/superpowers/specs/2026-07-04-creator-convention-design.md`）。

**Architecture:** 三层——约定与流程合并为 `creator/README.md`；对账逻辑在 `scripts/check-ledger.sh`（check 只读 / fix 写入）；挂载到现有 `make check` / `make sync`。不依赖 `.claude/`、不依赖 git hooks。

**Tech Stack:** bash + jq（与 `scripts/sync-skills.sh` 同构）。仓内无 bash 测试设施，验证用手动命令 + 预期输出。

## Global Constraints

- 文档禁止 emoji、禁止表格（用列表）
- Commit message 英文，Conventional Commits 格式
- 脚本风格对齐 `scripts/sync-skills.sh`：`#!/usr/bin/env bash` + `set -euo pipefail` + `case` 分发
- `skills.json` 修改只能追加或校验，禁止删除条目（清单记目标态，允许有账无目录）
- 不新增 make 目标，只扩展 `check` 与 `sync`

---

### Task 1: scripts/check-ledger.sh

**Files:**
- Create: `scripts/check-ledger.sh`

**Interfaces:**
- Produces: `check-ledger.sh <check|fix>`。`check`：有未上账目录或 name 不一致时退出非零；`fix`：未上账目录追加 `{ "name": "<dir>", "source": "custom" }` 到 `skills.json`，name 不一致仍退出非零

- [ ] **Step 1: 写脚本**

```bash
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
```

- [ ] **Step 2: 加执行权限**

Run: `chmod +x scripts/check-ledger.sh`

- [ ] **Step 3: 现状验证（mirror 跳过 + 全绿）**

Run: `scripts/check-ledger.sh check; echo "exit=$?"`
Expected: `[ok] drawio` 且 `exit=0`（drawio 已作为 mirror 上账，不产生新条目）

- [ ] **Step 4: 未上账目录被发现（check 报告且非零退出）**

Run:

```bash
mkdir -p skills/tmp-probe
printf -- '---\nname: tmp-probe\ndescription: probe\n---\n' > skills/tmp-probe/SKILL.md
scripts/check-ledger.sh check; echo "exit=$?"
```

Expected: 输出含 `[unledgered] tmp-probe` 且 `exit=1`

- [ ] **Step 5: fix 上账 + 幂等验证**

Run:

```bash
scripts/check-ledger.sh fix; echo "exit=$?"
jq -r '.[] | select(.name == "tmp-probe") | .source' skills.json
scripts/check-ledger.sh check; echo "exit=$?"
scripts/check-ledger.sh fix; jq '[.[] | select(.name == "tmp-probe")] | length' skills.json
```

Expected: 第一次 fix 输出 `[added] tmp-probe (source: custom)`、`exit=0`；jq 输出 `custom`；随后 check `exit=0`；再次 fix 后条目数仍为 `1`（幂等，无重复）

- [ ] **Step 6: name 不一致报错**

Run:

```bash
printf -- '---\nname: wrong-name\ndescription: probe\n---\n' > skills/tmp-probe/SKILL.md
scripts/check-ledger.sh check; echo "check_exit=$?"
scripts/check-ledger.sh fix; echo "fix_exit=$?"
```

Expected: 两次都输出 `[error] tmp-probe: frontmatter name 'wrong-name' != directory name`，`check_exit=1`、`fix_exit=1`

- [ ] **Step 7: 目标态条目不被删除**

Run: `jq -r '.[] | select(.source == "custom") | .name' skills.json | head -3`
Expected: `explaining-code`、`clarify`、`gitflow-commit` 仍在（脚本无删除逻辑，此为确认）

- [ ] **Step 8: 清理测试痕迹**

Run:

```bash
rm -rf skills/tmp-probe
git restore skills.json
scripts/check-ledger.sh check; echo "exit=$?"
```

Expected: `[ok] drawio`、`exit=0`，`git status --short skills.json` 无输出

- [ ] **Step 9: Commit**

```bash
git add scripts/check-ledger.sh
git commit -m "feat(skills): add ledger check script"
```

---

### Task 2: Makefile 挂载

**Files:**
- Modify: `Makefile`（`check` 与 `sync` 两个目标，当前各一行脚本调用）

**Interfaces:**
- Consumes: Task 1 的 `scripts/check-ledger.sh <check|fix>`
- Produces: `make check` 同时报 mirror 差异与账目漂移（任一失败则非零退出，且两者都执行）；`make sync` 拉 mirror 后自动补账

- [ ] **Step 1: 修改 check 目标**

`make check` 现为：

```make
check: ## Check mirror upstreams for updates (read-only)
	@scripts/sync-skills.sh check
```

`sync-skills.sh check` 在 mirror 过期时退出非零，直接串联会短路掉账目检查。改为两者都跑、任一失败整体非零：

```make
check: ## Check mirror upstreams and skills ledger (read-only)
	@r=0; scripts/sync-skills.sh check || r=1; scripts/check-ledger.sh check || r=1; exit $$r
```

- [ ] **Step 2: 修改 sync 目标**

```make
sync: ## Sync updated mirrors and fix skills ledger (no commit)
	@scripts/sync-skills.sh update
	@scripts/check-ledger.sh fix
```

（`sync-skills.sh update` 正常时退出 0，顺序执行即可；fix 的 name 不一致错误会中断并显示。）

- [ ] **Step 3: 验证**

Run: `make check; echo "exit=$?"` 与 `make help`
Expected: check 输出同时含 mirror 状态行（`[up-to-date] drawio` 或 `[outdated] ...`）和 `[ok] drawio`；mirror 全部最新时 `exit=0`。`make help` 显示更新后的两条描述

- [ ] **Step 4: Commit**

```bash
git add Makefile
git commit -m "feat(skills): wire ledger check into make check/sync"
```

---

### Task 3: creator/README.md

**Files:**
- Create: `creator/README.md`

**Interfaces:**
- Consumes: Task 2 的 `make sync`（流程收尾步骤）
- Produces: creator 元指令的约定与执行流程文档

- [ ] **Step 1: 写文档**

```markdown
# creator

待创建 skill / rule 的元指令。每个文件描述一个要生成的资产；由 Claude 按下面的流程执行，无脚本机制。本目录自用，不分发。

## 目录

- `skills/*.md` — 要创建的 skill
- `rules/*.md` — 要创建的 rule

## 元指令状态

frontmatter `tags` 标记：

- `stub` — 只有意图，内容待定
- `draft` — 内容完整，可执行
- `done` — 已执行，文件原地保留

## 执行流程

对 Claude 说「执行 `creator/skills/<name>.md`」：

1. 读元指令；`stub` 先与用户对齐内容、补全成 `draft` 再继续
2. 生成产物：
   - skill → `skills/<name>/SKILL.md`，格式参照 `templates/skill.md`
   - rule → `docs/rules/<name>.md`，格式参照 `templates/rule.md`
3. 自建 skill 一律放仓内 `skills/`，不写 `~/.claude/skills/` 等仓库外路径；元指令里写了别的路径，按本条修正
4. 元指令 frontmatter `tags` 改 `done`
5. 跑 `make sync` 上账（`skills.json` 自动补 `{ "name": "<name>", "source": "custom" }`）

本机安装：`pnpx skills add oNo500/infra-ai -s <name>`。
```

- [ ] **Step 2: 状态归类核对（不改元指令内容）**

Run: `grep -l 'tags:' creator/skills/*.md creator/rules/*.md | xargs grep 'tags:'`
Expected: `commit-lite.md` 与 `readme-rule.md` 含 `draft`，`python.md`、`typescript.md` 含 `stub`——与 spec 的归类一致，无需改动（`readme-rule.md` 是内容草稿，执行前先整理出元指令头，spec 已注明）

- [ ] **Step 3: Commit**

```bash
git add creator/README.md
git commit -m "docs(creator): add meta-instruction convention"
```

---

### Task 4: 根 README 与 skills/README.md 联动

**Files:**
- Modify: `README.md`（「内容」节末尾、「命令」节注释）
- Modify: `skills/README.md`（`make check`/`make sync` 的注释，约第 36-37 行）

**Interfaces:**
- Consumes: Task 2 扩展后的 make 语义、Task 3 的 `creator/README.md`

- [ ] **Step 1: 根 README「内容」节加 creator 条目**

在 `- [templates/](templates/) — 新项目模板（CLAUDE.md、settings.json 等）` 之后加：

```markdown
- [`creator/`](creator/) — 待创建 skill/rule 的元指令，自用不分发，见 [`creator/README.md`](creator/README.md)
```

- [ ] **Step 2: 根 README「命令」节注释更新**

```bash
make list    # 列出全部 skill 及来源
make check   # 检查 mirror 上游更新与 skills.json 账目（只读）
make sync    # 拉取有更新的 mirror、补齐账目（不 commit）
```

- [ ] **Step 3: skills/README.md 命令注释更新**

「日常同步」代码块改为：

```bash
make check   # 上游 commit 差异 + skills.json 账目检查（只读）
make sync    # 拉取更新的 mirror 并回写 commit，自动补齐账目（不 commit）
```

- [ ] **Step 4: Commit**

```bash
git add README.md skills/README.md
git commit -m "docs(skills): document ledger check and creator dir"
```
