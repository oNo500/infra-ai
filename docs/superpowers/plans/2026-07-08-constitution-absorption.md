# docs/constitution/ 收编 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `docs/constitution/` 收编进 meta 源→产物体系：constitution 走照搬型 rule，architecture 走模板型（`target: template`），删除 `docs/constitution/` 并更新引用。

**Architecture:** 每类产物一条 meta 源→构建规则→产物链。constitution：`meta/rules/constitution.md` → `rules/global/constitution.md`（copy 分发）。architecture：`meta/templates/architecture.md`（由 readme-rule 迁移）→ `templates/architecture.md`（实例化分发），构建规则新增 `meta/build/template.md`。

**Tech Stack:** 纯 markdown 与 git 操作，无代码。验证靠 `make list-rules` 与文件比对。

**Spec:** `docs/superpowers/specs/2026-07-07-constitution-absorption-design.md`

## Global Constraints

- 源代码/文档禁止 emoji；commit message 英文、Conventional Commits 格式
- `.claude/rules/constitution.md` 文件内容不动（身份变为分发副本）
- `rules/` 内产物必须 copy 即用（无占位符）；模板归 `templates/`
- `README.zh.md` 不存在，spec 中的同步检查项结论为无需处理
- `list-rules` 不扩展；`templates/` 下其他既有模板不补建 meta 源

---

### Task 1: constitution 收编（源 + 产物）

**Files:**
- Create: `meta/rules/constitution.md`
- Create: `rules/global/constitution.md`

**Interfaces:**
- Consumes: `docs/constitution/constitution.md` 现有内容（即 `.claude/rules/constitution.md`，两者已验证一致）
- Produces: `rules/global/constitution.md`，Task 3 删除 `docs/constitution/` 的前提；`meta/rules/constitution.md` 会出现在 `make list-rules` 输出中

- [x] **Step 1: 写元指令 `meta/rules/constitution.md`**

```markdown
---
name: constitution
target: rule
status: ready
scope: global
---

# constitution

跨项目通用的核心工程原则与红线，任何项目原样 copy 即生效。
产物必须与 infra-ai 自身的 `.claude/rules/constitution.md`（分发副本）保持一致；
修改原则时先改本元指令，重建产物后同步各分发副本。

要求：三条 Core Principles（Library-First、MVP-First、FP-First）+ 不可违反规则清单，
保持精简姿态化，不加项目特定内容。

## 内容素材

# Constitution

## Core Principles

### 一、Library-First

优先使用成熟的第三方库，禁止重复造轮子。引入新依赖前必须确认无等效库已在项目中存在。

### 二、MVP-First

功能最小化实现。只做当前需求必须的部分，禁止为假设的未来需求预建抽象或配置开关。

### 三、Functional Programming First

优先使用纯函数和不可变数据。禁止在不必要的情况下引入副作用和可变状态。

---

## 不可违反规则

- **TypeScript 类型**：禁止双重断言（`value as X as Y`）；禁止 `@ts-ignore`
- **禁止 emoji**：源代码中禁止使用 emoji（注释、日志输出除外，需明确标注原因）
- **Commit language**：commit message 使用英文，遵循 Conventional Commits 格式
- **不修改生成文件**：`AGENTS.md` 是构建产物，禁止手动编辑；只修改其对应的 rules 源文件
```

- [x] **Step 2: 构建产物 `rules/global/constitution.md`**

产物 = 现 `docs/constitution/constitution.md` 逐字节内容（无 frontmatter，global 类不写 `paths`）：

Run: `mkdir -p rules/global && cp docs/constitution/constitution.md rules/global/constitution.md`

- [x] **Step 3: 验证**

Run: `make list-rules && diff rules/global/constitution.md .claude/rules/constitution.md && echo "分发副本一致"`

Expected: list-rules 输出含 `constitution  ready  scope:global  已构建 rules/global/constitution.md` 一行（python/readme-rule/typescript 三行不变）；diff 无输出，打印「分发副本一致」。

- [x] **Step 4: Commit**

```bash
git add meta/rules/constitution.md rules/global/constitution.md
git commit -m "feat(rules): absorb constitution as verbatim global rule"
```

---

### Task 2: architecture 模板化（迁移 readme-rule + 构建规则 + 产物）

**Files:**
- Move: `meta/rules/readme-rule.md` → `meta/templates/architecture.md`（改写 frontmatter 与意图）
- Create: `meta/build/template.md`
- Create: `templates/architecture.md`

**Interfaces:**
- Consumes: `meta/rules/readme-rule.md` stub 的正文素材（架构模板草稿）
- Produces: `templates/architecture.md`（带占位符的模板产物）；`meta/build/template.md` 定义 `target: template` 的构建与实例化分发规则；`readme-rule` 从 `make list-rules` 输出中消失

- [x] **Step 1: 迁移并改写元指令**

Run: `mkdir -p meta/templates && git mv meta/rules/readme-rule.md meta/templates/architecture.md`

然后将 `meta/templates/architecture.md` 全文替换为：

```markdown
---
name: architecture
target: template
status: ready
---

# architecture

architecture rule 的模板：每个项目都该有一份描述自己技术栈、结构与编码约定的
architecture rule，骨架通用、内容项目专属。产物保留 `[ALL_CAPS]` 占位符，
分发时结合目标项目事实实例化，落目标项目 `.claude/rules/architecture.md`。

要求：覆盖 Tech Stack、Architecture（目录结构 + 依赖方向约定）、
Coding Conventions（命名、文件组织、语言红线、注释）四块；
占位符只留项目间真正会变的部分，通用约定直接写死。

## 内容素材

# [PROJECT_NAME] - Architecture

## Tech Stack

- **Runtime**: [Runtime]
- **Framework**: [Framework]
- **Language**: TypeScript
- **Database**: [Database · ORM]
- **Testing**: [Testing framework]
- **Toolchain**: [Package manager · Linter · CI]

## Architecture

[描述整体架构模式，例如：Feature-Based、分层架构等]

​```
src/
├── [directory]/    # [说明]
├── [directory]/    # [说明]
└── [directory]/    # [说明]
​```

[补充关键的架构约定，例如依赖方向规则]

## Coding Conventions

### Naming

| 类型 | 约定 | 示例 |
|------|------|------|
| 文件 / 目录 | kebab-case | `user-profile.ts` |
| 类 / 接口 | PascalCase | `UserService` |
| 函数 / 变量 | camelCase | `getUserData` |
| 常量 | UPPER_SNAKE_CASE | `API_BASE_URL` |

### File Organization

- 测试文件与源文件并置：`foo.ts` + `foo.test.ts` 放在同一目录
- 只按需创建子目录，不预建空目录

### TypeScript

- 禁止双重类型断言（`value as X as Y`）
- 禁止 `eslint-disable`、`@ts-ignore`

### Comments

- 注释说明"为什么"，不说明"是什么"
- 不写显而易见的注释
```

（注意：执行时上述素材中的代码围栏用真实反引号，此处为嵌套转义。）

- [x] **Step 2: 写构建规则 `meta/build/template.md`**

```markdown
# template 构建规则

`meta/templates/*.md` 是 template 元指令；本文件是从元指令构建 template 的规则。
产物品质由本文件决定：修改前先与用户确认，不做顺手编辑。

元指令是源，永久保留；`templates/<name>.md` 是构建产物，可随时按新的标准重新构建。
`templates/` 下没有 meta 源的既有模板（CLAUDE.md、settings.json 等）是手写模板，
改到谁再为谁补建元指令。

## 元指令格式

​```yaml
---
name: <产物名，与文件名一致>
target: template
status: stub | ready
---
​```

- `stub` — 意图占位，内容待补全
- `ready` — 规格完整，可构建

正文写意图与要求：模板用途、必须覆盖的板块、占位符原则，附内容素材。
产物落 `templates/<name>.md`，保留 `[ALL_CAPS]` 占位符。

## 构建

触发：对 Claude 说「构建 `meta/templates/<name>.md`」。

1. 读元指令；`status: stub` 先与用户对齐意图、补全成 `ready` 再继续
2. 生成产物到 `templates/<name>.md`，占位符只留项目间真正会变的部分

## 分发（实例化）

模板不 copy 即用（区别于 `rules/` 的照搬分发）：结合目标项目事实填全部占位符后，
落元指令声明的目标位置（如 architecture 落目标项目 `.claude/rules/architecture.md`）。
`scripts/init-project.sh` 脚手架新项目时一并实例化。

## 回写纪律

- 意图变更：先改元指令，再重新构建产物
- 直接在产物上做了有价值的修改：必须回写元指令，否则下次重建丢失
```

- [x] **Step 3: 构建产物 `templates/architecture.md`**

产物 = Step 1 元指令「内容素材」节的全文（从 `# [PROJECT_NAME] - Architecture` 起，代码围栏还原为真实反引号），不带 frontmatter。

- [x] **Step 4: 验证**

Run: `make list-rules && ls templates/`

Expected: list-rules 输出不再有 `readme-rule` 行（剩 constitution、python、typescript）；`templates/` 含 `architecture.md` 与既有五个模板。

- [x] **Step 5: Commit**

```bash
git add meta/templates/architecture.md meta/build/template.md templates/architecture.md
git commit -m "feat(templates): migrate readme-rule to architecture template with build rule"
```

（`git mv` 的删除侧已随 `meta/templates/architecture.md` 一并暂存。）

---

### Task 3: 删除 docs/constitution/ 并更新引用

**Files:**
- Delete: `docs/constitution/constitution.md`、`docs/constitution/architecture.md`
- Modify: `README.md`（「内容」清单）
- Rewrite: `.claude/rules/architecture.md`（对齐当前仓库结构）

**Interfaces:**
- Consumes: Task 1 产物 `rules/global/constitution.md`、Task 2 产物 `templates/architecture.md`（内容已吸收，目录才可删）
- Produces: 仓库不再有 `docs/constitution/` 及其引用

- [x] **Step 1: 删除目录**

Run: `git rm -r docs/constitution/`

- [x] **Step 2: 更新 `README.md` 内容清单**

删除这一行：

```markdown
- [`docs/constitution/`](docs/constitution/) — constitution 与 architecture，供其他项目引用
```

将 rules/ 行：

```markdown
- `rules/` — 可分发 rule 的构建产物：`global/`（无条件加载）+ `scoped/`（按 `paths` 动态加载）。暂空，随首个产物出现
```

改为：

```markdown
- [`rules/`](rules/) — 可分发 rule 的构建产物：`global/`（无条件加载，含 constitution）+ `scoped/`（按 `paths` 动态加载）
```

将 templates/ 行：

```markdown
- [`templates/`](templates/) — 新项目模板（CLAUDE.md、settings.json 等）
```

改为：

```markdown
- [`templates/`](templates/) — 新项目模板（CLAUDE.md、settings.json、architecture 等），分发时按目标项目实例化占位符
```

将 meta/ 行中的 `构建 skill/rule 的元指令（`skills/`、`rules/`）` 改为 `构建 skill/rule/template 的元指令（`skills/`、`rules/`、`templates/`）`。

- [x] **Step 3: 重写 `.claude/rules/architecture.md`**

全文替换为（对齐当前实际结构；原文描述的 `.claude/agents/`、`skills/ctx-init`、`context-management.md`、`skills.md` 等均已不存在）：

```markdown
# Architecture

## Project Structure

​```
infra-ai/
├── .claude/
│   ├── CLAUDE.md              # project entry point
│   ├── settings.json          # permissions + env (project-scoped)
│   └── rules/                 # 本仓自用规则，不分发
│       ├── constitution.md    # rules/global/constitution.md 的分发副本
│       └── architecture.md    # this file
├── skills.json                # skill 账：存在与来源的 SSoT
├── SKILLS.md                  # skills 专题（SSoT、创建、维护、使用）
├── skills/                    # skill 产物（custom + mirror；official 留上游）
├── meta/                      # 元指令源，永久保留
│   ├── build/                 # 构建规则，每类产物一份（rule.md、skill.md、template.md）
│   ├── rules/                 # rule 元指令
│   ├── skills/                # skill 元指令
│   └── templates/             # template 元指令
├── rules/                     # 可分发 rule 产物
│   ├── global/                # 无 paths frontmatter，无条件加载，copy 即用
│   └── scoped/                # paths frontmatter，按 glob 触发加载
├── templates/                 # 项目模板（含占位符，分发时实例化）
├── docs/
│   ├── mcp/                   # MCP server 知识文档
│   └── superpowers/           # 设计文档（specs + plans）
├── scripts/                   # make 目标的实现
├── Makefile
└── .mcp.json                  # MCP 配置（自用，key 用占位符）
​```

## 源→产物模型

- `meta/` 元指令是源，永久保留；`skills/`、`rules/`、`templates/` 下的构建产物可重建
- 构建与分发规则在 `meta/build/`，每类产物一份
- 产物上的有价值修改必须回写元指令，否则下次重建丢失

## 分发

- `rules/global|scoped/` — 照搬型，手动 copy 到目标项目 `.claude/rules/`
- `templates/` — 模板型，结合目标项目实例化占位符后落地
- 源只在本仓改，下游副本不回改

## 对账

- skills：`make list` / `make check` / `make sync`
- rules：`make list-rules`
```

（执行时内层代码围栏还原为真实反引号。）

- [x] **Step 4: 验证**

Run: `grep -rn "docs/constitution" README.md .claude/ Makefile scripts/ meta/ 2>/dev/null; make list-rules`

Expected: grep 无输出（引用已清干净）；list-rules 输出 constitution（ready、已构建）+ python + typescript 三行。

- [x] **Step 5: Commit**

```bash
git add -A README.md .claude/rules/architecture.md docs/constitution
git commit -m "refactor(rules): remove docs/constitution, absorbed into meta model"
```

注意：不要把工作区里上一项工作的待定改动（`skills.json`、`scripts/list-skills.sh`、`Makefile` 的 `list` 目标）混入——`git add` 只加上述指定路径。
