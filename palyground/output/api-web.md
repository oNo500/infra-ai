---
paths:
  - apps/api-web/**
---

# Web 全栈规则（api-web）

`apps/api-web/**` 全部代码 MUST 遵循本文件。

**架构基线**：Bulletproof React（生产级 features-first 架构）+ Hexagonal（业务逻辑封装于 features 纯函数，Route Handler 仅做 IO 边界）+ API-Route-First（mutation 经 API Route，Server Action 仅做 cache invalidation），落地于 Next.js 16 App Router + React 19 + Drizzle + Better Auth。

本文件遵循 RFC 2119 关键词：MUST / MUST NOT / SHOULD / SHOULD NOT / MAY。

执行任何代码写入前，AI MUST 在 `<architecture_thought>` 标签内评估当前任务，确认遵循路径后再编码。评估 MUST 覆盖：当前任务归属哪个 feature 或是否需新建、写操作走 API Route 还是 Server Action、是否触发跨 feature 组件提升、是否触发 §Human-in-the-loop。

## Tech Stack

- **Framework**: Next.js 16（App Router · Turbopack）+ React 19
- **UI**: `@workspace/ui`（基于 `@base-ui/react`）· `@workspace/icons` · Tailwind CSS v4
- **Auth**: Better Auth
- **Database**: PostgreSQL + Drizzle ORM（详见 `db.md`）
- **HTTP**: `@infra-x/fwrap`
- **Validation**: Zod
- **Env**: `@t3-oss/env-nextjs` + Zod
- **Theme**: next-themes
- **Testing**: Vitest · @testing-library/react · @testing-library/user-event

## 目录约定

```
src/
├── app/                          # Next.js App Router：路由 + 页面组装 + Route Handler
│   ├── (landing)/                # 公开访问（营销页）
│   ├── (auth)/                   # 认证流程（页面 + Better Auth catch-all API）
│   ├── (dashboard)/              # 登录后访问（页面 + 业务 API）
│   ├── layout.tsx
│   ├── provide.tsx               # ThemeProvider + Toaster
│   └── error.tsx / global-error.tsx / not-found.tsx / sitemap.ts
├── features/                     # 业务能力切片（仅业务原子，无页面组装）
│   └── {feature}/
│       ├── components/           # feature 私有组件（按需）
│       ├── hooks/                # feature 私有 hooks（按需）
│       ├── actions/              # Server Action：仅 revalidate（按需）
│       ├── queries/              # 服务端读操作（按需）
│       ├── mutations/            # 业务写操作（被 API Route 调用，按需）
│       └── lib/validators.ts     # Zod schema（API + 前端共享，按需）
├── components/                   # 跨 feature 共享组件
├── hooks/                        # 跨 feature 共享 hooks
├── lib/                          # 第三方库的项目级封装
│   ├── auth.ts                   # Better Auth 服务端
│   ├── auth-client.ts            # Better Auth 客户端
│   ├── fetch-client.ts           # HTTP 客户端
│   └── api/                      # Route Handler HOF
│       ├── with-auth.ts          # 鉴权 + session 注入
│       └── with-error-handler.ts # ZodError + DB 错误统一处理
├── db/                           # Drizzle 连接 + schema（详见 db.md）
├── config/
│   ├── env.ts                    # 环境变量集中声明
│   └── app-paths.ts              # 集中式路由路径
└── styles/globals.css
```

访问控制 SHALL 通过 App Router Route Groups 表达：`(landing)` 公开 / `(auth)` 认证流程 / `(dashboard)` 登录态。Route Group 不产生 URL 段，可与同业务域 API 共置。

## Feature Boundaries

### Fold into Existing Feature

MUST 同时满足：

- 属于同一业务能力（用户操作场景一致）
- 主数据模型与视图状态保留在该 feature 内
- 无需新增顶级路由或导航项

### Create New Feature

满足任一即 SHALL 新建：

- 独立业务能力（与现有 feature 用户场景不重叠）
- 拥有一级 URL 段（例：`/posts` vs `/users`）
- 可独立移除而不影响其他 feature

### Cross-feature Component Promotion

≥ 2 个 feature 需要同一组件时 SHALL 提升至 `src/components/`，MUST NOT 为共享而新建 feature。

### Feature 内部组织

- 小 feature（文件数 ≤ 5）SHOULD 平铺至 `features/{name}/*.tsx`
- 大 feature SHALL 按职责拆子目录（`components/` / `hooks/` / `actions/` / `queries/` / `mutations/` / `lib/`）
- feature 之间 MUST NOT 互相 import；共享逻辑 SHALL 下沉至 `lib/` 或 `components/`

## Mutation Strategy

mutation 入口 MUST 优先选 API Route，Server Action 仅承担 cache invalidation：

- **API Route**：所有业务写操作（表单提交 / 按钮触发 / Webhook / 第三方消费）
- **Server Action**：仅 `revalidateTag` / `revalidatePath`，MUST NOT 包含业务逻辑

业务逻辑 MUST 集中于 `features/{name}/mutations/` 与 `features/{name}/queries/` 纯函数，MUST NOT 依赖 Next.js 运行时。

### API Route Pattern

`route.ts` MUST 保持薄层，结构：**HOF 组合（鉴权 + 错误处理）→ Zod 校验 → 调用 feature 函数 → 返回响应**。

- HOF 组合 SHALL 用 `withErrorHandler(withAuth(...))`：外层捕获 ZodError / DB 错误，内层注入 session
- 输入校验 MUST 使用 Zod，MUST NOT 手写校验
- Zod schema 定义于 `features/{name}/lib/validators.ts`，API Route 与前端表单 SHALL 共享同一 schema
- 跨路由复用逻辑（鉴权 / 错误处理 / 日志）SHALL 通过 HOF 组合，放 `lib/api/`

## Authentication

- 服务端：`src/lib/auth.ts` 导出 `auth`
- 客户端：`src/lib/auth-client.ts` 导出 `authClient`
- catch-all：`app/(auth)/api/auth/[...all]/route.ts` 由 Better Auth 接管，MUST NOT 修改
- Better Auth 自动生成的 schema 字段 MUST NOT 手动修改

## UI Library

- `@workspace/ui` MUST NOT 使用 Radix 风格的 `asChild`（基于 `@base-ui/react`，使用 `render` prop / style anchor）
- `@workspace/ui` 组件由 `shadcn cli` 管理，MUST NOT 手动编辑

## Anti-patterns

- `app/` 路由文件 MUST NOT 包含业务逻辑（数据请求 / 状态管理 / 业务判断）；MAY 包含页面组装
- `features/` MUST NOT 包含 `*-page.tsx` 入口文件；页面组装 SHALL 由 `app/{route}/page.tsx` 完成
- `features/` 下 MUST NOT 创建 `index.ts` barrel 文件（破坏 server/client 边界、tree-shaking、IDE 跳转）
- `lib/` MUST 仅包含第三方库的项目级封装，MUST NOT 含业务逻辑
- 组件或 Route Handler MUST NOT 直接调用 `db` / `drizzle`，SHALL 通过 feature 的 `queries/` / `mutations/`
- 组件 SHOULD 默认 Server Component；仅在需要交互、状态、浏览器 API 时标 `'use client'`
- 组件内 MUST NOT 硬编码路由路径，MUST 使用 `config/app-paths.ts`
- Server Action 内 MUST NOT 写业务逻辑（仅 revalidate）
- MUST NOT 预创建空目录

## Testing

- 测试文件 SHALL 与源码 colocate：`foo.ts` + `foo.test.ts(x)` 同目录
- Vitest 使用 `test.projects` 多 project 配置，`globals: true` 与 `setupFiles` MUST 在每个 project 内声明
- 必须 mock 的模块：`next/link` / `next-themes` / `@/config/env` / `@/lib/auth-client`
- 测试 server-only 模块时 MUST `vi.mock('server-only', () => ({}))` 避免 jsdom 环境抛错
- `mutations/` 与 `queries/` 是纯函数，SHOULD 优先写单元测试（mock `db`）

## Human-in-the-loop

- feature 归属判断模糊（既像并入又像新建）— 边界划分判定，停下确认
- mutation 是否走 Server Action（突破"仅 revalidate"约束）— 偏离架构基线决策
- 引入新 ORM / Auth 库 — 技术栈扩展决策
- 跨 feature 共享需求超出 `src/components/` 能承载（如共享业务 hook 链）— 架构演进决策

代码风格（命名约定 / 文件命名 / import 顺序）由 `oxlint` 强制。
