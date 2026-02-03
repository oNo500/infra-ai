---
name: architecting-nextjs
description: 提供 Next.js 15 + React 19 架构指导，基于 Bulletproof React 模式。在创建新项目、组织代码结构、设置开发规范时使用此技能。
---

# Next.js Architecture

基于 Bulletproof React 的 Next.js 15 + React 19 项目架构指南。包含 3 个类别的规则，用于指导项目结构、代码标准和开发规范。

## 适用场景

在以下情况下参考这些指南：
- 创建新的 Next.js 项目
- 组织项目文件结构
- 设置代码规范和标准
- 配置开发环境和工具链

## 规则分类

| 优先级 | 类别 | 影响 | 前缀 |
|--------|------|------|------|
| 1 | 架构核心 (Architecture Core) | CRITICAL | `arch-` |
| 2 | 项目标准 (Project Standards) | HIGH | `std-` |
| 3 | 开发规范 (Development) | MEDIUM | `dev-` |

## 快速参考

### 1. 架构核心 (CRITICAL)

- `arch-core` - 项目概述和核心架构原则
- `arch-project-structure` - 目录结构和模块组织

### 2. 项目标准 (HIGH)

- `std-project-standards` - 文件命名、导入规范、环境变量
- `std-style` - UI 组件和样式规范

### 3. 开发规范 (MEDIUM)

- `dev-development` - 开发命令和依赖管理
- `dev-stack` - 技术栈配置

## 如何使用

查找具体规则时，直接读取规则文件：

```
rules/arch-core.md
rules/arch-project-structure.md
rules/std-project-standards.md
rules/std-style.md
rules/dev-development.md
rules/dev-stack.md
```

每个规则文件包含详细说明和代码示例。
