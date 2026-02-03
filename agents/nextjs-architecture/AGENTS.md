# Next.js Architecture

> Version 1.0.0 | xiu

## Abstract

Next.js 15 + React 19 项目架构指南，基于 Bulletproof React 模式。包含架构核心、项目标准、开发规范三个类别的规则。

---

## Table of Contents

1. [架构核心](#1-架构核心) — **CRITICAL**
   - 1.1 [架构核心原则](#11-)
   - 1.2 [项目结构](#12-)
2. [项目标准](#2-项目标准) — **HIGH**
   - 2.1 [样式规范](#21-)
   - 2.2 [项目标准](#22-)
3. [开发规范](#3-开发规范) — **MEDIUM**
   - 3.1 [开发规范](#31-)
   - 3.2 [技术栈](#32-)

---

## 1. 架构核心

**Impact: CRITICAL**

项目架构的基础原则，包括目录结构、模块组织和依赖关系。这是项目可维护性的根基。

### 1.1 架构核心原则

**Impact: CRITICAL**

架构模式: Bulletproof React - 特性驱动、单向依赖的生产级架构

核心原则:

- 特性模块化：按功能组织代码，避免扁平结构
- 单向数据流：shared -> features -> app，features 之间**禁止**互相导入
- 最小化实现：遵循 MVP 原则，如非必要不进行拓展

### 1.2 项目结构

**Impact: CRITICAL**

架构模式：采用 Bulletproof React - 特性驱动、单向依赖的三层架构

三层架构：shared -> features -> app（单向数据流）

**Example:**

```bash
.
├── src
│   ├── app # App Router（基于文件系统的路由）
│   │   ├── _components
│   │   ├── page.tsx                 # 首页 /
│   │   ├── not-found.tsx            # 404 页面
│   │   ├── provider.tsx             # 客户端 Provider
│   ├── config
│   │   ├── env.ts
│   │   └── paths.ts
│   ├── features     # 功能模块
│   │   ├── auth
│   │   │   ├── assets
│   │   │   ├── api
│   │   │   ├── components
│   │   │   ├── hooks
│   │   │   ├── stores
│   │   │   ├── hooks
│   │   │   ├── types
│   │   │   ├── utils
│   ├── components # shared components
│   │   ├── errors
│   │   │   └── main.tsx
│   │   ├── layouts
│   │   │   └── content-layout.tsx
│   ├── hooks # shared hooks
│   ├── lib  # shared lib 业务行为
│   ├── styles
│   ├── types # shared types
│   │   └── api.ts
│   └── utils # shared utils 纯逻辑/无状态
```

---

## 2. 项目标准

**Impact: HIGH**

代码规范和项目标准，包括文件命名、导入规范、样式指南等，确保代码一致性。

### 2.1 样式规范

**Impact: HIGH**

核心要求：

- 颜色空间：使用 OKLCH（非 HSL）

### 2.2 项目标准

**Impact: HIGH**

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

---

## 3. 开发规范

**Impact: MEDIUM**

开发环境配置和工具链设置，包括包管理器、依赖选择、技术栈配置等。

### 3.1 开发规范

**Impact: MEDIUM**

核心规则：

- 必须使用 pnpm 运行所有开发命令
- 禁止使用 npm/yarn 运行脚本

依赖选择规则：

| 场景 | 规则 |
|------|------|
| 添加新依赖前 | 必须通过 Context7 查询最新文档，确认 API 用法 |
| 选择替代方案 | 必须优先选择项目已使用的库（避免重复功能的库） |
| 类型定义 | 必须同时安装 @types/* 包（如需要） |

### 3.2 技术栈

**Impact: MEDIUM**

核心框架:
- React 19 + Next.js 15 + TypeScript 5.9

UI 组件:
- 优先级：shadcn/ui -> Tailwind CSS
- 图标库：Lucide React
- 基础：Radix UI

样式方案:
- Tailwind CSS 4

状态管理:
- 服务器状态：React Query
- 客户端状态：Zustand

工具链:
- 包管理器：pnpm
- API Mock：MSW (Mock Service Worker)
- 代码规范：ESLint (扁平化配置) + TypeScript 严格模式

---

