# CLAUDE.md 填写指南（单体/子包）

使用 `assets/CLAUDE-template.md`，填写后输出到 `CLAUDE.md`。

## 概要

你正在生成项目根目录的 `CLAUDE.md`，这是 Claude Code 的项目级入口文件。**最后生成**，确保 `.claude/rules/` 下的文件已存在。

目标：**<50 行**。CLAUDE.md 只是入口，详细规则已分散到 `.claude/rules/` 各文件中，无需在此重复。

## 填写要求

- **项目名称**：从 package.json name 或目录名推断
- **概述**：只写 1-2 句 — 技术细节已在 architecture.md 中
- **快速命令**：从 `package.json` scripts 中取实际命令（dev、test、build）
- **不要**在 CLAUDE.md 中重复 rules 文件里的内容

## 输出前验证

- 无残留的 `[ALL_CAPS]` 占位符
- 行数 < 50 行
- `<!-- -->` 注释删除
