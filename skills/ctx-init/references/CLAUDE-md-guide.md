# CLAUDE.md 填写指南（单体/子包）

使用 `assets/CLAUDE-template.md`，填写后输出到 `CLAUDE.md`。

## 概要

你正在生成项目根目录的 `CLAUDE.md`，这是 Claude Code 的项目级入口指令文件。**最后生成**，确保所有被引用的文档（constitution.md、project-context.md）已存在。

按以下流程操作：

1. 确认 `.claude/docs/constitution.md` 和 `.claude/docs/project-context.md` 已生成
2. 从 constitution.md 中提取 2-3 条最重要的不可违反规则，作为关键约束
3. 填充模板，写入 `CLAUDE.md`

## 填写要求

- **项目名称**：从 package.json name 或目录名推断
- **概述**：只写 1-2 句 — 技术细节已在 project-context.md 中
- **关键约束**：只列 2-3 条最重要的不可违反规则，从 constitution.md 中提取
- **文档链接**：路径使用 `/.claude/docs/` 绝对路径

## 输出前验证

- 无残留的 `[ALL_CAPS]` 占位符
- 引用的文件路径均已存在
- `<!-- -->` 注释删除
