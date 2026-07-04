# Skills 维护系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `infra-ai/skills/` 建成自建 + 镜像 skill 的单一数据源，用 Makefile 薄封装维护命令，镜像入 git。

**Architecture:** 脚本移入 `scripts/` 并修正相对路径，Makefile 只封装对本仓的维护操作（check/sync），镜像 skill 与自建 skill 平铺于 `skills/`（入 git），靠 `mirrors.json` 区分。分发用 `pnpx skills add`。

**Tech Stack:** bash + jq + gh CLI + pnpx giget（镜像同步），GNU make（入口），pnpx skills（分发）。

## Global Constraints

- 脚本注释/commit message 用英文，遵循 Conventional Commits
- 源代码禁止 emoji（脚本 echo 输出禁止 emoji）
- 镜像同步 `sync` 只拉取，不自动 commit
- `skills/` 平铺，兼容 `pnpx skills` 的 `skills/<name>/` 识别约定
- GitHub repo 路径：`oNo500/infra-ai`

---

### Task 1: 移动 sync-skills.sh 到 scripts/ 并修正相对路径

把 `sync-skills.sh` 从根目录移入 `scripts/`，修正两个路径变量：脚本移位后 `$(dirname "$0")` 指向 `scripts/`，需上移一级找到根目录的 `mirrors.json`，并把 giget 目标从 `~/.claude/skills` 改为根目录的 `skills/`。

**Files:**
- Move: `sync-skills.sh` → `scripts/sync-skills.sh`
- Modify: `scripts/sync-skills.sh:4-5`（两个路径变量）

**Interfaces:**
- Consumes: 根目录 `mirrors.json`（现有，含 drawio 一条）
- Produces: `scripts/sync-skills.sh check` 与 `scripts/sync-skills.sh update` 两个子命令；update 拉取到 `<repo-root>/skills/<name>/`

- [ ] **Step 1: git mv 脚本到 scripts/**

```bash
git mv sync-skills.sh scripts/sync-skills.sh
```

- [ ] **Step 2: 修正 MIRRORS_FILE 和 SKILLS_DIR 路径**

把 `scripts/sync-skills.sh` 第 4-5 行：

```bash
MIRRORS_FILE="$(dirname "$0")/mirrors.json"
SKILLS_DIR="$HOME/.claude/skills"
```

改为：

```bash
MIRRORS_FILE="$(dirname "$0")/../mirrors.json"
SKILLS_DIR="$(dirname "$0")/../skills"
```

- [ ] **Step 3: 验证 check 能找到 mirrors.json 并识别 drawio 过期**

Run: `./scripts/sync-skills.sh check`
Expected: 输出 `[outdated] drawio: 3f8e810b2ecdd6c8345e9a6eb54b5c1037f8209f -> 04a4ce1be33cfe620d322c611df82002d395e637`（证明相对路径改对了，且脚本正常读到 mirrors.json；退出码 1 因有更新，属预期）

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-skills.sh
git commit -m "refactor(scripts): move sync-skills.sh into scripts/ and fix relative paths"
```

---

### Task 2: 用 sync 拉取 drawio 镜像进 skills/，验证链路

跑 `update`，让脚本把 drawio 从上游拉到新建的 `skills/drawio/`，并回写 `mirrors.json`（新 commit + 今日日期）。这一步验证整条镜像入 git 链路真的通。

**Files:**
- Create: `skills/drawio/`（giget 产物，含上游 SKILL.md 等）
- Modify: `mirrors.json`（drawio 的 commit + updated 被回写）

**Interfaces:**
- Consumes: Task 1 产出的 `scripts/sync-skills.sh update`
- Produces: `skills/drawio/SKILL.md`；`mirrors.json` 中 drawio.commit = `04a4ce1be33cfe620d322c611df82002d395e637`

- [ ] **Step 1: 跑 update 拉取 drawio**

Run: `./scripts/sync-skills.sh update`
Expected: 输出 `[update] drawio ...` 后接 giget 拉取日志，最后 `[done] drawio -> 04a4ce1be33cfe620d322c611df82002d395e637`

- [ ] **Step 2: 验证文件落到 skills/drawio/ 且含 SKILL.md**

Run: `ls skills/drawio/SKILL.md && head -5 skills/drawio/SKILL.md`
Expected: 文件存在，SKILL.md 有 frontmatter（`name:` 字段应为 `drawio`）

- [ ] **Step 3: 验证 mirrors.json 已回写**

Run: `jq '.[0].commit' mirrors.json`
Expected: `"04a4ce1be33cfe620d322c611df82002d395e637"`

- [ ] **Step 4: 验证 check 现在报 up-to-date**

Run: `./scripts/sync-skills.sh check`
Expected: `[up-to-date] drawio`（退出码 0）

- [ ] **Step 5: Commit**

```bash
git add skills/drawio mirrors.json
git commit -m "feat(skills): mirror drawio from jgraph/drawio-mcp"
```

---

### Task 3: 新建 Makefile 薄封装

Makefile 只封装对本仓维护的命令：`check`、`sync`，加自动生成的 `help`。target 只调用 `scripts/sync-skills.sh`，不写业务逻辑。`init-project.sh` 不进 Makefile。

**Files:**
- Create: `Makefile`

**Interfaces:**
- Consumes: `scripts/sync-skills.sh`（Task 1 产出）
- Produces: `make check`、`make sync`、`make help` 三个 target

- [ ] **Step 1: 写 Makefile**

Create `Makefile`:

```makefile
.PHONY: help check sync
.DEFAULT_GOAL := help

help: ## List all commands
	@grep -E '^[a-zA-Z0-9_-]+:.*##' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*##"} {printf "  %-10s %s\n", $$1, $$2}'

check: ## Check mirror upstreams for updates (read-only)
	@scripts/sync-skills.sh check

sync: ## Sync updated mirrors into skills/ (no commit)
	@scripts/sync-skills.sh update
```

- [ ] **Step 2: 验证 make help 列出三条命令**

Run: `make help`
Expected: 输出三行，含 `check`、`sync`、`help` 及各自描述

- [ ] **Step 3: 验证 make check 等价于脚本调用**

Run: `make check`
Expected: `[up-to-date] drawio`（与 Task 2 Step 4 一致）

- [ ] **Step 4: Commit**

```bash
git add Makefile
git commit -m "build: add Makefile wrapping mirror sync commands"
```

---

### Task 4: 移除 skills-lock.json

`skills-lock.json` 是 `pnpx skills` 的消费端产物，源仓库不持有。`git rm` 移除，不进 `.gitignore`。

**Files:**
- Delete: `skills-lock.json`

**Interfaces:**
- Consumes: 无
- Produces: 无（纯清理）

- [ ] **Step 1: git rm 移除**

```bash
git rm skills-lock.json
```

- [ ] **Step 2: 验证已从工作区和索引移除**

Run: `ls skills-lock.json 2>&1; git status --short skills-lock.json`
Expected: `ls: skills-lock.json: No such file or directory`，git status 显示 `D  skills-lock.json`（已暂存删除）

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: remove skills-lock.json (consumer artifact, not source)"
```

---

### Task 5: 写 skills/README.md 维护 + 分发文档

在 `skills/` 下写 README，说明两类 skill 的维护流程与分发方式。`pnpx skills` 不会把 README 当 skill。

**Files:**
- Create: `skills/README.md`

**Interfaces:**
- Consumes: Task 1-4 定型的命令（`make check`/`make sync`）与仓库路径 `oNo500/infra-ai`
- Produces: 无（文档）

- [ ] **Step 1: 写 README.md**

Create `skills/README.md`:

````markdown
# Skills

自建与镜像 skill 的单一数据源，同步到 GitHub，供其他项目/设备用 `pnpx skills` 管理。
不发布到 skills.sh 注册表。

自建与镜像**平铺同库**，靠仓库根的 `mirrors.json` 区分：列在里面 = 镜像，不在 = 自建。

## 自建 skill

1. `/skill-creator` 创建到 `skills/<name>/`（遵循 skills.sh 标准 + Anthropic best practices）
2. commit（走 `gitflow-commit`）→ push

## 镜像 skill

上游不在 skills.sh 注册表内、但有可用 SKILL.md 的开源仓库。用 giget 拉单目录，不克隆整库。

### 新增

往根目录 `mirrors.json` 加一条：

```json
{ "name": "<上游 SKILL.md 的 name>", "repo": "<owner>/<repo>", "path": "<SKILL.md 所在目录>" }
```

然后 `make sync` 拉取。

### 日常同步

```bash
make check   # 只报上游 commit 差异 (只读)
make sync    # 有更新才 giget 拉到 skills/<name>/ 并回写 mirrors.json (不 commit)
```

`make sync` 后自行 review 再提交：

```bash
git diff skills/
git add skills/ mirrors.json
git commit -m "chore(skills): sync mirrors"
git push
```

## 分发

任何项目/设备：

```bash
pnpx skills add oNo500/infra-ai -s <name>   # 挑单个
pnpx skills add oNo500/infra-ai --all       # 全装
```

上游更新后各处 `pnpx skills update` 拉最新。
````

- [ ] **Step 2: 验证 README 存在且非空**

Run: `head -3 skills/README.md`
Expected: 输出 `# Skills` 标题及首段

- [ ] **Step 3: Commit**

```bash
git add skills/README.md
git commit -m "docs(skills): add maintenance and distribution guide"
```

---

## Self-Review

**1. Spec coverage:**
- 目录结构 → Task 2（skills/）+ Task 3（Makefile）+ Task 5（README）
- 三条流程 → Task 5 README 记录；镜像流程由 Task 1-2 落地
- 脚本管理 Makefile 薄封装 → Task 3
- sync-skills.sh 移位路径改动 → Task 1
- 清理 skills-lock.json → Task 4
- 分发 → Task 5 README
- 全部 spec 章节有对应 task，无缺口。

**2. Placeholder scan:** 无 TBD/TODO；每个改动步骤给出完整命令或完整文件内容；每个验证步骤给出确切命令与预期输出。

**3. Type consistency:** 路径引用一致——`scripts/sync-skills.sh`、`skills/<name>/`、`mirrors.json`（根目录）、`oNo500/infra-ai` 全文一致。drawio 目标 commit `04a4ce1...` 在 Task 2 Step 1/3/spec 中一致。
