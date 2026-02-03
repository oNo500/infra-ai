---
title: 开发规范
impact: MEDIUM
impactDescription: 开发命令和依赖管理
tags: development, pnpm, dependencies
---

## 开发规范

核心规则：

- 必须使用 pnpm 运行所有开发命令
- 禁止使用 npm/yarn 运行脚本

依赖选择规则：

| 场景 | 规则 |
|------|------|
| 添加新依赖前 | 必须通过 Context7 查询最新文档，确认 API 用法 |
| 选择替代方案 | 必须优先选择项目已使用的库（避免重复功能的库） |
| 类型定义 | 必须同时安装 @types/* 包（如需要） |
