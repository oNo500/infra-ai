# Workflow Rules 填写指南

## 概要

你正在生成 `.claude/rules/workflow.md`，包含开发场景和操作规则。

**无 frontmatter paths**（始终加载）。

参考模板：`assets/workflow-template.md`。

## 填写要求

- **开发场景**：按 MECE 原则梳理，每个场景是一组有序步骤
- **命令**：从 `package.json` scripts 中取实际脚本名，不要写猜测的命令
- **Modification Rules**：使用声明性语言（MUST/禁止），避免"应该"等模糊表达

## 常见场景

根据项目类型按需包含：

- 初始化项目
- 开发新功能
- 提交前检查
- 生产构建
- 数据库迁移（后端项目）

## 输出前验证

- 所有命令已在 `package.json` scripts 中验证存在
- 无残留的 `[ALL_CAPS]` 占位符
- `<!-- -->` 注释删除
