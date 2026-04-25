---
paths:
  - apps/admin-shadcn/**/*.test.ts
  - apps/admin-shadcn/**/*.test.tsx
  - apps/admin-shadcn/src/testing/**
  - apps/admin-shadcn/e2e/**
---

# Frontend 测试规则（admin-shadcn）

测试文件 MUST 遵循本文件。

**架构基线**：Testing Trophy（Kent C. Dodds）+ Testing Library 哲学（behavior over implementation），落地于 Vitest + @testing-library/react + MSW v2 + Playwright。

本文件遵循 RFC 2119 关键词：MUST / MUST NOT / SHOULD / SHOULD NOT / MAY。

执行任何测试编写前，AI MUST 在 `<architecture_thought>` 标签内评估当前测试，确认遵循路径后再编写。评估 MUST 覆盖：测试归属哪一层（Unit / Integration / E2E）、用户视角的断言点、需要 mock 的边界、是否复用 §Test Infrastructure 已有 fixture / handler。

## Testing Trophy

测试投入分布：Static < Unit < **Integration** > E2E。

- **Static**：TypeScript + ESLint，编译期保障
- **Unit**（`.test.ts`，Vitest）— 纯逻辑：`lib/` / `hooks/` / `utils/`
- **Integration**（`.test.tsx`，Vitest + RTL + MSW）— feature 工作流：渲染 → 用户交互 → 断言可见结果
- **E2E**（Playwright）— 关键用户旅程，真实浏览器

## File Locations

- Unit / Integration 测试 SHALL 与源码 colocate：`foo.ts` + `foo.test.tsx` 同目录
- E2E 测试 SHALL 位于 `apps/admin-shadcn/e2e/`，独立 `playwright.config.ts`

## Test Infrastructure

`src/testing/` 仅放共享基础设施，MUST NOT 放测试用例。

- `setup.ts` — 全局 vitest setup：MSW 生命周期、RTL `cleanup()`、`clearAuthState()` 与 router mock 在 `afterEach` 重置、`next/navigation` 全局 mock（稳定 `mockRouter` 对象）
- `render.tsx` — `renderWithProviders`：包裹 `QueryClientProvider`（`retry: false` / `staleTime: 0`）；任何触及 TanStack Query 的组件 MUST 通过它渲染
- `auth-fixtures.ts` — `mockUser` / `mockTokens` / `mockCredentials` / `setupAuthenticatedState()` / `clearAuthState()`
- `msw/server.ts` — `setupServer(...handlers)`；生命周期由 `setup.ts` 管理
- `msw/handlers/` — 一个 backend context 一个文件；响应 MUST 通过 `@workspace/api-types` 的 `components['schemas'][...]` 类型化

## Testing Conventions

### 行为优先（Testing Library 哲学）

- MUST 测试用户可观察的行为与结果，MUST NOT 断言实现细节
- MUST 通过 `userEvent` 驱动交互，MUST NOT 直接调用组件方法
- 断言 SHALL 基于用户可见的 DOM（label / role / text），MUST NOT 基于 className / 实现内部 state

### Mock 策略

- HTTP 请求 MUST 通过 MSW 拦截，MUST NOT 直接 mock `fetch` 或 API client 函数
- MSW server 以 `onUnhandledRequest: 'error'` 启动，未声明 handler 的请求 MUST 视为测试失败
- `next/navigation` 已在 `setup.ts` 全局 mock；测试中 SHALL 通过 `vi.mocked(useRouter().push)` 访问，MUST NOT 在测试文件中重新 mock

### 文件与导入

- 测试文件后缀 MUST 为 `.test.ts` / `.test.tsx`
- `vitest` 的 `globals` 已禁用；`describe` / `it` / `expect` / `vi` MUST 显式 import

## Anti-patterns

- MUST NOT 在 `src/testing/` 放测试用例
- MUST NOT mock TanStack Query 内部 / API client 实现
- MUST NOT 用 `data-testid` 替代语义化查询（label / role / text 优先）
- MUST NOT 测试样式与 className（除非样式即业务规则）

## Human-in-the-loop

- 集成测试覆盖度判断模糊（要测多深 / 要 mock 多少）— 测试边界判定，停下确认
- 引入新的全局 mock（如 `next/headers`）— 影响所有测试，需评估
- 选择 E2E vs Integration 不明确（关键用户旅程定义）— 测试金字塔分层决策
