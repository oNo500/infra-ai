---
title: 项目标准
impact: HIGH
impactDescription: 代码规范
tags: standards, naming, imports, typescript
---

## 项目标准

核心要求：

- 文件名统一使用 kebab-case（包括 React 组件）
- 代码风格遵循 ESLint 规范（运行 pnpm lint 检查）
- TypeScript 严格模式，禁止使用 any 类型
- 禁止在代码中使用 emoji（除非用户明确要求）

**语义化**：布尔值用 `is/has/should` 前缀，事件处理器用 `handle/on` 前缀，避免缩写。

## 文件导入

核心要求：

- 导入规范：统一使用 @/* 绝对路径，禁止相对路径
- 文档查询：使用 Context7 MCP 工具查询库文档后再实现功能

## 环境变量

- 命名前缀：客户端变量必须以 NEXT_PUBLIC_ 开头
- 必须使用 `config.ts`
