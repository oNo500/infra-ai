---
name: project-agents
description: 普通项目根目录 CLAUDE.md 的模板 - 主入口，引用所有 .claude/docs/ 文档
---

# Project CLAUDE.md 模板

用于生成普通项目根目录的 `CLAUDE.md`。

该文件是 Claude Code 自动加载的主入口，保持简洁，通过链接指向 `.claude/docs/` 中的详细文档。

---

## 模板

```markdown
# [项目名称]

[1-2 句话描述项目用途和技术定位]

## 文档

| 文档 | 内容 |
|------|------|
| [宪章](/.claude/docs/constitution.md) | 核心原则与不可违反的规则 |
| [项目上下文](/.claude/docs/project-context.md) | 技术栈、架构、编码规范、工作流、测试与修改规则 |

## 关键约束

- [最重要的约束 1，例如"禁止在组件中直接调用 API，必须通过 store"]
- [最重要的约束 2，例如"所有数据库查询必须使用参数化语句"]
- [最重要的约束 3]

> 完整规则见 [宪章](/.claude/docs/constitution.md)。
```

---

## AI 填写指南

- **概述只写 1-2 句** — 技术细节放入 project-context.md
- **关键约束只列 2-3 条最重要的** — 这是给 Claude 的第一印象，只放不可违反的规则
- **链接路径以项目根目录为基准** — 使用 `/.claude/docs/` 绝对路径
- **最后生成此文件** — 确保引用的所有文档已存在
