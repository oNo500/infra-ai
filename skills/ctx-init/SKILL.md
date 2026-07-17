---
name: ctx-init
description: >-
  Initializes Claude Code configuration for a project from the infra-ai
  central source -- picks a profile, copies its rules, instantiates
  CLAUDE.md and architecture templates. Use when setting up .claude/
  config for a new or existing project, as an alternative to claude init.
---

# ctx-init

从中心源 infra-ai 初始化目标项目的 `.claude/` 配置：选 profile、拷 rules、
实例化模板。中心源默认 `~/code/infra-ai`，可用环境变量 `INFRA_AI_ROOT` 覆盖。

规则源只在中心仓修改，拷到目标项目的副本不回改。

## 输出文件

- `.claude/CLAUDE.md` — 项目入口（<50 行，最后生成）
- `.claude/rules/<name>.md` — profile 内每条 rule 一个文件（原样拷贝）
- `.claude/rules/architecture.md` — 模板结合项目事实实例化
- `.claude/settings.json` — 模板拷贝

## 工作流

复制此 checklist 并逐步完成：

```
Progress:
- [ ] Step 1: 扫描项目，判断类型与技术栈
- [ ] Step 2: 读 profiles.json，选 profile
- [ ] Step 3: 从中心源拷贝 profile 内的 rules
- [ ] Step 4: 实例化模板（architecture -> settings -> CLAUDE.md）
- [ ] Step 5: 验证
```

### Step 1: 扫描项目，判断类型与技术栈

读取存在的配置文件：`package.json`、`pnpm-workspace.yaml`、`turbo.json`、
`nx.json`、`pyproject.toml`，以及根级 `packages/`、`apps/` 目录。

判断两件事：

- **单体 / monorepo** — 存在 workspace 配置或根级 `packages/`/`apps/`
  目录即 monorepo
- **技术栈** — 从依赖判断框架（Next.js、React、NestJS、Python 等）

### Step 2: 读 profiles.json，选 profile

读中心源 `$INFRA_AI_ROOT/profiles.json`，按 Step 1 的项目类型选最接近的
profile（每个 profile 含 `description` 与 `rules` 清单）。

> [!IMPORTANT]
> 没有合适的 profile 时提请用户裁决，不要自造 rule 组合。

### Step 3: 从中心源拷贝 profile 内的 rules

把 profile `rules` 清单里的每条 rule 从中心源拷到目标项目：

- 源：`$INFRA_AI_ROOT/rules/global/<name>.md` 或 `rules/scoped/<name>.md`
  （同名只会存在于其一）
- 目标：`.claude/rules/<name>.md`
- **原样拷贝，不做任何修改** —— global rule 无 `paths` frontmatter，
  无条件加载；scoped rule 带 `paths` frontmatter，按 glob 触发加载

### Step 4: 实例化模板

按依赖顺序生成，均以 `$INFRA_AI_ROOT/templates/` 为源：

1. `templates/architecture.md` -> `.claude/rules/architecture.md`：
   结合 Step 1 的项目事实填充——`[ALL_CAPS]` 占位符全部替换，
   不适用的章节整节删除
2. `templates/settings.json` -> `.claude/settings.json`：直接拷贝
3. `templates/CLAUDE.md` -> `.claude/CLAUDE.md`：**最后生成**，
   确保引用的 rules 文件均已存在；目标 <50 行，模板内的
   `<!-- -->` 指导注释全部删除

**monorepo 差异**：不生成单一 architecture.md，改为每个有实质代码的
子包一份 scoped rule（纯配置包如 `tsconfig`、`eslint-config` 忽略），
文件名与子包目录名同名，frontmatter 按实际路径：

```yaml
---
paths:
  - packages/<name>/**
---
```

### Step 5: 验证

- 无 `[ALL_CAPS]` 占位符残留，模板指导注释已删除
- `CLAUDE.md` 行数 <50
- scoped rule（含 monorepo 子包 rule）带 `paths` frontmatter，
  global rule 不带
- 拷贝的 rule 与中心源逐字节一致（未被改写）
