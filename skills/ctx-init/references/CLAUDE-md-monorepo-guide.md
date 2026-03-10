# CLAUDE.md 填写指南（monorepo 根）

使用 `assets/CLAUDE-monorepo-template.md`，填写后输出到 `CLAUDE.md`。

## 概要

你正在生成 monorepo 根目录的 `CLAUDE.md`。**最后生成**，确保所有 `.claude/rules/` 文件已存在。

目标：**<50 行**。提供包结构总览 + 统一命令即可，详细规则由 `.claude/rules/` 承载。

## 填写要求

- **包结构表**：只列有独立职责的包；纯配置包（`config-eslint`、`tsconfig`）可省略
- **统一命令**：从根 `package.json` scripts 中取，使用实际脚本名
- **单独启动命令**：以实际包管理器过滤语法为准
  - pnpm：`pnpm --filter @scope/name dev`
  - nx：`nx run name:dev`
  - turbo：`turbo run dev --filter=name`
- 删除不适用的章节

## 输出前验证

- 无残留的 `[ALL_CAPS]` 占位符
- 所有命令已在根 package.json 中验证存在
- 包路径与实际目录结构一致
- 行数 < 50 行
- `<!-- -->` 注释删除
