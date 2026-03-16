---
name: ctx-init
description: >
  Generates AI context files for a project using the .claude/rules/ system.
  Use when initializing AI context, configuring Claude for a project, creating CLAUDE.md,
  setting up .claude/rules/ directory structure, or as an alternative to `claude init`.
---

# ctx-init

## 输出文件

**单体项目**：
1. `.claude/CLAUDE.md`
2. `.claude/rules/constitution.md` — 通用原则（无 paths，始终加载）
3. `.claude/rules/architecture.md` — 技术栈 + 架构约定（无 paths，始终加载）

**monorepo**：
1. `.claude/CLAUDE.md`
2. `.claude/rules/constitution.md` — 全局原则（无 paths，始终加载）
3. `.claude/rules/<子包名>.md` — 每个有实质代码的子包一个文件，文件名与子包目录名同名，带 path-specific frontmatter

> **Path-specific**：通过 YAML frontmatter `paths` 定义匹配路径，仅在处理匹配文件时触发加载。


## 工作流

复制此 checklist 并逐步完成：

```
Progress:
- [ ] Step 1: 扫描仓库，判断项目类型
- [ ] Step 2: 生成 .claude/rules/constitution.md
- [ ] Step 3: 生成项目规范 rules 文件
- [ ] Step 4: 生成 .claude/CLAUDE.md
- [ ] Step 5: 验证
```

---

### Step 1: 扫描仓库，判断项目类型

读取以下文件（存在的话）：`package.json`、`pnpm-workspace.yaml`、`turbo.json`、`nx.json`、根级 `packages/`、`apps/` 目录。

判断类型：
- **monorepo** — 存在 workspace 配置（`pnpm-workspace.yaml`、`turbo.json`、`nx.json`）或根级 `packages/`/`apps/` 目录
- **前端项目** — 依赖中有 React、Next.js、Vue、Nuxt 等
- **后端项目** — 依赖中有 NestJS、Express、Fastify、Hono 等
- **全栈/混合** — 同时有前端和后端依赖

---

### Step 2: 生成 `.claude/rules/constitution.md`

参考 [references/constitution-guide.md](references/constitution-guide.md)。

- 无 frontmatter paths（始终加载）
- 包含：核心价值观、不可违反的规则

---

### Step 3: 生成项目规范 rules 文件

根据 Step 1 判断分支处理：

**单体项目** → 生成 `.claude/rules/architecture.md`
- 参考 [references/architecture-guide.md](references/architecture-guide.md)
- 无 frontmatter paths（始终加载）
- 包含：技术栈、目录结构、编码规范（涵盖该项目所有层：前端/后端/测试）

**monorepo** → 为每个有实质代码的子包生成独立 rules 文件
- 忽略纯配置包（如 `config-eslint`、`tsconfig`、`eslint-config` 等）
- 文件名：子包目录名（如 `web.md`、`api.md`、`mobile.md`）
- frontmatter paths：`packages/<name>/**` 或 `apps/<name>/**`（按实际路径）
- 内容：该子包的技术栈 + 架构约定，参考 [references/architecture-guide.md](references/architecture-guide.md)

frontmatter 示例（monorepo 子包）：
```yaml
---
paths:
  - packages/web/**
---
```

---

### Step 4: 生成 `.claude/CLAUDE.md`

参考 [references/CLAUDE-md-guide.md](references/CLAUDE-md-guide.md)。

**最后生成**，确保所有 rules 文件已存在。目标：<50 行。

---

### Step 5: 验证

- 所有 `[ALL_CAPS]` 占位符已替换为真实内容
- 不适用的章节已整节删除
- `<!-- -->` 注释已删除
- `CLAUDE.md` 行数 < 50 行
- monorepo 子包 rules 文件均有正确的 frontmatter paths
- 单体项目 rules 文件（constitution.md、architecture.md）均无 frontmatter paths
