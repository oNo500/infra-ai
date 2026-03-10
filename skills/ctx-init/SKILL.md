---
name: ctx-init
description: >
  Generates AI context files for a project using the .claude/rules/ system.
  Use when initializing AI context, configuring Claude for a project, creating CLAUDE.md,
  setting up .claude/rules/ directory structure, or as an alternative to `claude init`.
---

# ctx-init

## 输出文件

| 文件 | 用途 |
|------|------|
| `CLAUDE.md` | 极简入口：项目名 + 概述 + 快速命令（目标 <50 行） |
| `.claude/rules/constitution.md` | 核心原则（始终加载，无 paths） |
| `.claude/rules/architecture.md` | 整体架构约定（始终加载，无 paths） |
| `.claude/rules/workflow.md` | 开发工作流（始终加载，无 paths） |
| `.claude/rules/frontend.md` | 前端规则（paths: src/**/*.{ts,tsx} 等，按需生成） |
| `.claude/rules/backend.md` | 后端规则（paths: src/**/*.ts，按需生成） |
| `.claude/rules/testing.md` | 测试规则（paths: **/*.{test,spec}.ts，按需生成） |

> `.claude/rules/*.md` 文件由 Claude Code 自动加载（无需 @import）。支持 frontmatter `paths:` 字段实现 path-specific 规则。

## 工作流

复制此 checklist 并逐步完成：

```
Progress:
- [ ] Step 1: 扫描仓库，判断项目类型
- [ ] Step 2: 生成 .claude/rules/constitution.md
- [ ] Step 3: 生成 .claude/rules/architecture.md
- [ ] Step 4: 生成 .claude/rules/workflow.md
- [ ] Step 5: 按需生成 path-specific rules（frontend/backend/testing）
- [ ] Step 6: 生成轻量 CLAUDE.md
- [ ] Step 7: 验证所有文件一致
```

---

### Step 1: 扫描仓库，判断项目类型

读取以下文件（存在的话）：`package.json`、`pnpm-workspace.yaml`、`turbo.json`、`nx.json`、根级 `packages/`、`apps/` 目录。

判断类型：
- **monorepo 根目录** — 存在 workspace 配置（`pnpm-workspace.yaml`、`turbo.json`、`nx.json`）或根级 `packages/`/`apps/` 目录
- **前端项目** — 依赖中有 React、Next.js、Vue、Nuxt 等
- **后端项目** — 依赖中有 NestJS、Express、Fastify、Hono 等
- **全栈/混合** — 同时有前端和后端依赖

---

### Step 2: 生成 `.claude/rules/constitution.md`

参考 [references/constitution-guide.md](references/constitution-guide.md)。

- 无 frontmatter paths（始终加载）
- 包含：核心价值观、不可违反的规则

---

### Step 3: 生成 `.claude/rules/architecture.md`

参考 [references/architecture-guide.md](references/architecture-guide.md)。

- 无 frontmatter paths（始终加载）
- 包含：目录结构、模块划分、依赖方向
- 根据项目类型选择对应示例：
  - 前端（Next.js/React）→ 参考 [assets/frontend-rules-example.md](assets/frontend-rules-example.md)
  - 后端（NestJS）→ 参考 [assets/nestjs-rules-example.md](assets/nestjs-rules-example.md)
  - 其他 → 使用 [assets/architecture-template.md](assets/architecture-template.md)

---

### Step 4: 生成 `.claude/rules/workflow.md`

参考 [references/workflow-guide.md](references/workflow-guide.md)。

- 无 frontmatter paths（始终加载）
- 包含：开发场景（新增功能、修改存量代码、提交前检查）
- 从 `package.json` scripts 中取实际命令

---

### Step 5: 按需生成 path-specific rules

根据 Step 1 判断的项目类型，选择性生成：

**前端项目** → 生成 `.claude/rules/frontend.md`
- 参考 [assets/frontend-rules-example.md](assets/frontend-rules-example.md)
- frontmatter paths: `["src/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"]`

**后端项目** → 生成 `.claude/rules/backend.md`
- 参考 [assets/nestjs-rules-example.md](assets/nestjs-rules-example.md)
- frontmatter paths: `["src/**/*.ts"]`

**任何有测试的项目** → 生成 `.claude/rules/testing.md`
- 参考 [assets/testing-rules-template.md](assets/testing-rules-template.md)
- frontmatter paths: `["**/*.{test,spec}.{ts,tsx}"]`

---

### Step 6: 生成 `CLAUDE.md`

**最后生成**，确保所有 rules 文件已存在。

- **monorepo 根目录** → 参考 [references/CLAUDE-md-monorepo-guide.md](references/CLAUDE-md-monorepo-guide.md)
- **单体项目或 monorepo 子包** → 参考 [references/CLAUDE-md-guide.md](references/CLAUDE-md-guide.md)

目标：<50 行。只包含项目名、1-2 句概述、快速命令。不在 CLAUDE.md 中重复 rules 内容。

---

### Step 7: 验证

- 所有 `[ALL_CAPS]` 占位符已替换为真实内容
- 不适用的章节已整节删除
- `<!-- -->` 注释已删除
- `CLAUDE.md` 行数 < 50 行
- `.claude/rules/` 下所有文件的 frontmatter（如有）格式正确
