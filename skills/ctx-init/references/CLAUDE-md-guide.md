# CLAUDE.md 填写指南

## 概要

你正在生成 `.claude/CLAUDE.md`，这是 Claude Code 的项目级入口文件。**最后生成**，确保 `.claude/rules/` 下的文件已存在。

目标：**<50 行**。CLAUDE.md 只是入口，详细规则已分散到 `.claude/rules/` 各文件中，无需在此重复。

## 填写要求

### 通用（单体 + monorepo）

- **项目名称**：从 `package.json` name 或目录名推断
- **概述**：只写 1-2 句 — 技术细节已在 rules 文件中
- **快速命令**：从根 `package.json` scripts 中取实际脚本名（dev、test、build）
- **不要**在 CLAUDE.md 中重复 rules 文件里的内容

### monorepo 额外内容

**包结构列表**：只列有独立职责的包，纯配置包（`config-eslint`、`tsconfig`）可省略：

```markdown
- `packages/web` — Next.js 前端
- `packages/api` — NestJS 后端
```

**单独启动命令**：以实际包管理器过滤语法为准：

- pnpm：`pnpm --filter @scope/name dev`
- nx：`nx run name:dev`
- turbo：`turbo run dev --filter=name`

## 输出前验证

- 无残留的 `[ALL_CAPS]` 占位符
- 行数 < 50 行
- `<!-- -->` 注释删除
- monorepo：包路径与实际目录结构一致，所有命令已在根 `package.json` 中验证存在
