---
name: filling-guide
description: 填写 assets/ 模板时的 AI 指南
---

# 模板填写指南

## 通用规则

- **从仓库上下文推断** — 优先从 `package.json`、`tsconfig.json`、配置文件、README 中提取，再向用户提问
- **不留方括号 token** — 所有 `[ALL_CAPS]` 占位符必须替换为真实内容；不适用的章节整节删除
- **注释可删除** — `<!-- -->` 注释替换后无需保留

## constitution.md

每条原则：
- 名称行简洁，如"一、Library-First"、"Test-Driven Development（NON-NEGOTIABLE）"
- 内容声明性、可测试 — 避免模糊语言（"应该考虑" → "MUST"/"禁止"）
- 包含理由 — 说明这条规则防止了什么问题

版本规则：
- `RATIFICATION_DATE`：首次采用日期；若未知标记 `TODO(RATIFICATION_DATE)`
- `LAST_AMENDED_DATE`：本次修改日期（ISO 格式 `YYYY-MM-DD`），版本从 `1.0.0` 开始
- MAJOR：删除或重新定义原则；MINOR：新增原则；PATCH：措辞澄清

Governance 至少包含：Constitution 优先级声明、修订程序、合规预期。

## project-context.md

- **Tech Stack**: Core 只列框架级依赖；Key Libraries 只为非显而易见的库写用法说明
- **Architecture**: 目录结构只列有独立职责的目录；Key Decisions 优先记录非显而易见的决策
- **Coding Conventions**: 不记录 linter 能强制的规则；只记录需要人工遵守的约定
- **Development Workflow**: 命令从 `package.json` 脚本中取，按使用频率排序
- **Testing/Modification Rules**: 声明性、可测试 — 避免模糊语言（"应该" → "MUST"/"禁止"）

## CLAUDE.md（普通项目）

- 概述只写 1-2 句 — 技术细节放入 project-context.md
- 关键约束只列 2-3 条最重要的不可违反规则
- 链接路径使用 `/.claude/docs/` 绝对路径
- 最后生成此文件，确保引用的所有文档已存在

## CLAUDE-monorepo.md

- 统一命令从根 `package.json` 脚本中取，使用实际脚本名
- 单独启动命令以实际包管理器过滤语法为准（pnpm `--filter`、nx `run`、turbo `run`）
- 跨包约束只写真实存在的，从 tsconfig、eslint 配置、CI 流程中推断
- 包结构表只列有独立职责的包；纯配置包（如 `config-eslint`）可省略
- 删除不适用的章节
