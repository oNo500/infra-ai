---
paths:
  - apps/admin-shadcn/**
---

# Frontend 规则（admin-shadcn）

`apps/admin-shadcn/**` 全部代码 MUST 遵循本文件。

**架构基线**：Bulletproof React（生产级 features-first 架构）+ 借鉴 FSD 的业务能力切分理念，落地于 Next.js 16 App Router + TypeScript。

规则与现有代码冲突时按 §Human-in-the-loop 处理。

本文件遵循 RFC 2119 关键词：MUST / MUST NOT / SHOULD / SHOULD NOT / MAY。

执行任何代码写入前，AI MUST 在 `<architecture_thought>` 标签内评估当前任务，确认遵循路径后再编码。评估 MUST 覆盖：当前任务归属哪个 feature 或是否需新建 feature、是否触发跨 feature 组件提升、新增依赖是否符合 §Tech Stack、是否触发 §Human-in-the-loop。

## Tech Stack

- **Framework**: Next.js 16（App Router · Turbopack）
- **Language**: TypeScript
- **UI**: `@workspace/ui`（基于 `@base-ui/react`）· shadcn · Tailwind CSS v4
- **Data Fetching**: TanStack Query v5 · openapi-fetch · openapi-react-query
- **Forms**: React Hook Form · Zod · @hookform/resolvers
- **Tables**: @tanstack/react-table
- **Animation**: Motion
- **Testing**: Vitest · @testing-library/react · MSW v2 · Playwright（详见 `admin-shadcn-test.md`）
- **Env**: @t3-oss/env-nextjs
- **Lint**: ESLint

## 目录约定

```
src/
├── app/              # Next.js App Router：路由 + 页面组装
│   ├── (auth)/      # 公开访问（login / register / oauth）
│   ├── (protected)/ # 登录态访问
│   │   └── (admin)/ # 管理员访问
│   └── (landing)/   # 着陆页
├── features/         # 业务能力切片（仅业务原子，无页面组装）
│   └── {feature}/
│       ├── components/   # feature 私有组件（按需）
│       └── hooks/        # feature 私有 hooks（按需）
├── components/       # 跨 feature 共享组件
├── hooks/            # 跨 feature 共享 hooks
├── lib/              # 第三方库的项目级封装（api-client / react-query / token / rbac 等）
├── utils/            # 纯工具函数（零第三方运行时依赖）
├── config/
│   ├── env.ts        # 环境变量（@t3-oss/env-nextjs）
│   └── app-paths.ts  # 集中式路由路径
└── testing/          # 测试基础设施（setup / renderWithProviders / fixtures / MSW handlers）
```

访问控制 SHALL 通过 App Router Route Groups 表达：`(auth)` 公开 / `(protected)` 登录 / `(protected)/(admin)` 管理员。

## Feature Boundaries

### Fold into Existing Feature

MUST 同时满足：

- 属于同一业务能力（用户操作场景一致）
- 主数据模型与视图状态保留在该 feature 内
- 无需新增顶级路由或导航项

### Create New Feature

满足任一即 SHALL 新建：

- 独立业务能力（与现有 feature 用户场景不重叠）
- 拥有一级 URL 段（例：`/users` vs `/roles`）
- 可独立移除而不影响其他 feature

### Cross-feature Component Promotion

≥ 2 个 feature 需要同一组件时 SHALL 提升至 `src/components/`，MUST NOT 为共享而新建 feature。

## UI Library

- `@workspace/ui` MUST NOT 使用 Radix 风格的 `asChild`（基于 `@base-ui/react`，使用 `render` prop / style anchor）
- `@workspace/ui` 组件由 `shadcn cli` 管理，MUST NOT 手动编辑

## API Types

- 由 `openapi-typescript` 生成至 `packages/api-types/src/openapi.d.ts`
- MUST 通过 `@workspace/api-types` 包消费，MUST NOT 手写
- API 变更后 SHALL 重新生成：`pnpm --filter @workspace/api-types api:gen`

## Anti-patterns

- `app/` 路由文件 MUST NOT 包含业务逻辑（数据请求 / 状态管理 / 业务判断）；MAY 包含页面组装（引入 feature 组件、layout、provider 装配）
- `features/` MUST NOT 包含 `*-page.tsx` 入口文件；页面组装 SHALL 由 `app/{route}/page.tsx` 完成，feature 仅导出业务原子（components / hooks / types）
- `features/` 下 MUST NOT 创建 `index.ts` barrel 文件（直接从源文件 import）
- `lib/` MUST 仅包含第三方库的项目级封装，MUST NOT 含业务逻辑；纯工具函数 SHALL 放 `utils/`
- 组件 SHOULD 默认 Server Component；仅在需要交互、状态、浏览器 API 时标 `'use client'`
- 组件内 MUST NOT 硬编码路由路径，MUST 使用 `config/app-paths.ts`
- 角色字符串 MUST NOT 硬编码，MUST 从 `@/lib/rbac` 导入
- MUST NOT 预创建空目录

## Human-in-the-loop

- feature 归属判断模糊（既像并入又像新建）— 边界划分判定，停下确认
- 跨 feature 共享需求超出 `src/components/` 能承载（如共享业务 hook 链）— 架构演进决策
- 第三方库选型偏离 §Tech Stack — 技术栈扩展决策

代码风格（命名约定 / 文件命名 / import 顺序）由 `oxlint` 强制。
