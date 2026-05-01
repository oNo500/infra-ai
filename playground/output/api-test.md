---
paths:
  - apps/api/**/*.spec.ts
  - apps/api/**/*.e2e-spec.ts
  - apps/api/src/__tests__/**
---

# API 测试规则

测试文件 MUST 遵循本文件。

**架构基线**：Test Pyramid（Mike Cohn）+ Hexagonal Testing（port 接口注入 mock，aggregate 直接 `new`），落地于 Vitest + `@golevelup/ts-vitest` + Supertest。

本文件遵循 RFC 2119 关键词：MUST / MUST NOT / SHOULD / SHOULD NOT / MAY。

执行任何测试编写前，AI MUST 在 `<architecture_thought>` 标签内评估当前测试，确认遵循路径后再编写。评估 MUST 覆盖：测试归属哪一层（Unit / E2E）、被测对象的依赖边界（哪些 mock / 哪些 `new`）、是否复用 §Test Infrastructure 已有 mock factory / fixture。

## Test Pyramid

测试投入分布：Unit > E2E。

- **Unit**（`.spec.ts`，Vitest）— `application/services/` / `domain/`
- **E2E**（`.e2e-spec.ts`，Vitest + Supertest + 真实 DB）— `presentation/controllers/` / `infrastructure/repositories/`

`presentation/controllers/` 与 `infrastructure/repositories/` MUST NOT 写 unit 测试，E2E 是其唯一覆盖路径。

## File Locations

- Unit 测试 SHALL 与源码 colocate：`foo.ts` + `foo.spec.ts` 同目录
- E2E 测试 SHALL 位于 `apps/api/src/__tests__/`
- 测试基础设施 SHALL 位于 `src/__tests__/unit/factories/`：mock factory、domain fixture、architecture guard
- E2E 全局 setup SHALL 在 `src/__tests__/setup.ts`（env 校验、`globalThis.e2ePrefix`）

## Test Infrastructure

### Mock Factory（`src/__tests__/unit/factories/mock-factory.ts`）

- 每个 context 一组 `createXxxMocks()` 工厂
- port 接口 mock MUST 通过 `createMock<T>()`（`@golevelup/ts-vitest`）
- MUST NOT mock domain 类（aggregate / value object 直接 `new`）

### Domain Fixtures（`src/__tests__/unit/factories/domain-fixtures.ts`）

- domain 对象构造 SHALL 通过 aggregate 工厂方法（`Order.create()`）或 `reconstitute()`
- MUST NOT 通过 DTO 或数据库构造 fixture

## Authoring Conventions

### Unit 测试

- Service MUST 通过 `new Service(...mocks)` 构造，MUST NOT 使用 `Test.createTestingModule`
- aggregate / value object MUST 直接 `new`，MUST NOT mock
- 依赖 MUST 通过构造函数注入 mock，MUST NOT 用 property injection 或 spy 替换实例方法

### E2E 测试

- E2E 数据 MUST 通过 `globalThis.e2ePrefix`（timestamp 前缀）命名空间隔离，防止并发污染
- E2E MUST 启动真实 NestJS 容器与数据库，MUST NOT mock infrastructure 层

### 通用

- 测试文件后缀 MUST 为 `.spec.ts`（unit）/ `.e2e-spec.ts`（E2E）
- `vitest` 的 `globals` 已禁用；`describe` / `it` / `expect` / `vi` MUST 显式 import

## Anti-patterns

- MUST NOT 使用 `Test.createTestingModule`（破坏可测试性，强制启动 NestJS 容器）
- MUST NOT mock aggregate / value object 等 domain 对象
- MUST NOT 通过 DTO 或直接写库构造 domain fixture
- MUST NOT 在 `presentation/controllers/` 或 `infrastructure/repositories/` 下写 unit 测试
- MUST NOT 在 `src/__tests__/unit/` 放测试用例（仅放基础设施）

## Human-in-the-loop

- 被测对象需要的依赖既非 port 也非 NestJS 全局 provider — 边界判定，可能暗示设计问题
- E2E 与 Unit 覆盖度交叉（同一逻辑两层都测）— 投入产出比决策
- 引入新的测试库（如 `testcontainers`）— 测试基础设施扩展决策
