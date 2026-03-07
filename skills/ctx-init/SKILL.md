---
name: ctx-init
description: >
  Generates AI meta-prompt files (CLAUDE.md, project-context.md, constitution.md) for a project.
  Use when initializing AI context, configuring Claude for a project, creating CLAUDE.md,
  setting up .claude directory structure, or as an alternative to `claude init`.
---

# ctx-init

为项目生成 AI 元提示文件，建立 Claude 理解项目所需的上下文结构。

## 输出文件

| 文件 | 用途 | 适用场景 |
|------|------|----------|
| `CLAUDE.md` | Claude Code 的项目级指令 | 所有项目 |
| `.claude/docs/project-context.md` | 项目架构、技术栈详情 | 单体项目 / monorepo 子包 |
| `.claude/docs/constitution.md` | AI 行为准则与价值观约束 | 所有项目 |

## 参考文件

| 文件 | 用途 |
|------|------|
| [references/CLAUDE-md-guide.md](references/CLAUDE-md-guide.md) | 单体项目 CLAUDE.md 编写指南 |
| [references/CLAUDE-md-monorepo-guide.md](references/CLAUDE-md-monorepo-guide.md) | Monorepo 根目录 CLAUDE.md 编写指南 |
| [references/project-context-guide.md](references/project-context-guide.md) | project-context.md 编写指南 |
| [references/constitution-guide.md](references/constitution-guide.md) | constitution.md 编写指南 |

## 工作流

复制此 checklist 并逐步完成：

```
Progress:
- [ ] Step 1: 扫描仓库，判断项目类型
- [ ] Step 2: 生成 constitution.md
- [ ] Step 3: 生成 CLAUDE.md
- [ ] Step 4: 生成 project-context.md（非 monorepo 根时）
- [ ] Step 5: 验证所有文件引用一致
```

---

### Step 1: 扫描仓库，判断项目类型

读取以下文件（存在的话）：`package.json`、`pnpm-workspace.yaml`、`turbo.json`、`nx.json`、根级 `packages/`、`apps/` 目录。

判断结果：

- **monorepo 根目录** — 存在 workspace 配置（`pnpm-workspace.yaml`、`turbo.json`、`nx.json`）或根级 `packages/`/`apps/` 目录
- **单体项目或 monorepo 子包** — 其他情况

---

### Step 2: 生成 constitution.md

生成项目最高宪法，参考 [references/constitution-guide.md](references/constitution-guide.md)。

---

### Step 3: 生成 CLAUDE.md

**最后生成**，确保所有被引用的文档已存在。

- **monorepo 根目录** → 参考 [references/CLAUDE-md-monorepo-guide.md](references/CLAUDE-md-monorepo-guide.md)，使用 `assets/CLAUDE-monorepo-template.md`，输出到 `CLAUDE.md`
- **单体项目或 monorepo 子包** → 参考 [references/CLAUDE-md-guide.md](references/CLAUDE-md-guide.md)，使用 `assets/CLAUDE-template.md`，输出到 `CLAUDE.md`

---

### Step 4: 生成 project-context.md

跳过条件：monorepo 根目录不需要此文件。

参考 [references/project-context-guide.md](references/project-context-guide.md)，使用 `assets/project-context-template.md`，填写后输出到 `.claude/docs/project-context.md`。

---

### Step 5: 验证

- 所有 `[ALL_CAPS]` 占位符已替换为真实内容
- 不适用的章节已整节删除
- `<!-- -->` 注释已删除
- CLAUDE.md 中引用的文件路径均已存在
