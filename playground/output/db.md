---
paths:
  - apps/api-web/src/db/**
---

# App 内置 Database 规则（api-web）

`apps/api-web/src/db/**` 全部代码 MUST 遵循本文件。

**架构基线**：Drizzle ORM Schema-as-Code（单 app 内置）+ Repository-Through-Feature（数据访问 MUST 经 feature `queries/` `mutations/`，业务代码 MUST NOT 直接调 `db`），落地于 PostgreSQL + Better Auth。

本文件遵循 RFC 2119 关键词：MUST / MUST NOT / SHOULD / SHOULD NOT / MAY。

执行任何 schema 或数据访问代码写入前，AI MUST 在 `<architecture_thought>` 标签内评估当前任务，确认遵循路径后再编码。评估 MUST 覆盖：是否触及 Better Auth 自动生成表、是否涉及 timestamp 字段、数据访问入口（feature queries/mutations vs 直接 db）、是否触发 §Human-in-the-loop。

## 目录约定

```
apps/api-web/src/db/
├── index.ts      # Drizzle 连接实例
└── schema.ts     # 全部 schema 集中声明
```

## Schema 约束

- schema MUST 集中于 `src/db/schema.ts` 单文件
- 所有 `timestamp` 字段 MUST 标注 `{ withTimezone: true }`（Better Auth 传入 UTC ISO 字符串，无时区列会触发 OAuth `expires_at < created_at` 约束错误）
- 字段命名：数据库列 SHALL 用 `snake_case`，TypeScript 标识符 SHALL 用 `camelCase`（Drizzle 自动映射）
- Better Auth 相关表（`user` / `session` / `account` / `verification`）由 `pnpm auth:generate` 维护，MUST NOT 手动修改

## Migrations

- Dev：SHALL 使用 `db:push` 同步 schema
- Prod：MUST 通过 `db:generate` 生成 migration 文件，再 `db:migrate` 执行
- migration 文件 MUST NOT 手动编辑

## Access Pattern

- 业务代码（components / route handler / page）MUST NOT 直接 import `db`，MUST 经 `features/{name}/queries/` 或 `features/{name}/mutations/`
- `queries/` 仅放只读操作，`mutations/` 仅放写操作
- 两者 MUST 为纯函数，便于 mock `db` 单元测试

## Anti-patterns

- MUST NOT 在 `app/` 路由文件、components、Server Action 内直接调 `db` / `drizzle`
- MUST NOT 手改 Better Auth 自动生成的 schema 字段
- MUST NOT 使用无时区 timestamp（`timestamp without time zone`）
- MUST NOT 手改 migration 文件
- MUST NOT 在 schema 内写业务逻辑（仅表定义 + 关系）

## Human-in-the-loop

- 需修改 Better Auth 字段（影响认证流程）— 兼容性判定，停下确认
- 字段变更需要数据迁移脚本（非纯 DDL）— 数据迁移策略决策
- schema 体量增长触发拆分需求（单文件 → 按域拆分目录）— 架构演进决策
