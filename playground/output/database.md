---
paths:
  - packages/database/**
---

# Database Package 规则（`@workspace/database`）

`packages/database/**` 全部代码 MUST 遵循本文件。

**架构基线**：Drizzle ORM Schema-as-Code + Domain-Grouped Schema Organization，落地于 PostgreSQL + drizzle-kit + tsdown。

本文件遵循 RFC 2119 关键词：MUST / MUST NOT / SHOULD / SHOULD NOT / MAY。

执行任何代码写入前，AI MUST 在 `<architecture_thought>` 标签内评估当前任务，确认遵循路径后再编码。评估 MUST 覆盖：schema 归属哪个 domain（顶层文件 / 子目录）、是否需要更新 `relations.ts`、是否触发 §Schema Change Workflow、是否触发 §Human-in-the-loop。

## Tech Stack

- **ORM**: Drizzle ORM
- **Driver**: PostgreSQL（`pg` · `postgres`）
- **Migrations**: `drizzle-kit`
- **Build**: `tsdown`
- **Language**: TypeScript（ESM）

## 目录约定

```
packages/database/
├── src/
│   ├── schemas/                     # 按业务域分组
│   │   ├── identity/                # 认证表（遵循 Better Auth 约定）
│   │   │   ├── users.schema.ts
│   │   │   ├── accounts.schema.ts
│   │   │   ├── sessions.schema.ts
│   │   │   ├── verifications.schema.ts
│   │   │   └── index.ts             # 子目录 barrel
│   │   ├── audit/                   # 审计数据
│   │   │   ├── audit-logs.schema.ts
│   │   │   ├── login-logs.schema.ts
│   │   │   └── index.ts
│   │   ├── {domain}.schema.ts       # 单表域：顶层单文件
│   │   └── index.ts                 # 总 barrel
│   ├── relations.ts                 # 所有表关系集中声明
│   └── index.ts                     # package entry
├── drizzle/                         # 生成的 migrations（MUST NOT 手改）
├── scripts/
│   ├── seed.ts
│   └── local-db.ts
└── drizzle.config.ts
```

## Schema Ownership

schema 物理位置 SHALL 反映业务域所有权。多表域 SHALL 用子目录，单表域 SHALL 用顶层单文件。

| 子目录 | 所属 context | 业务代码可写入？ |
|---|---|---|
| `identity/` | `identity` | 可，但字段 MUST 保持 Better Auth 兼容 |
| `audit/` | `audit-log` | 可 |

## Schema Authoring

- 一域一文件：`{domain}.schema.ts`，多表域用同名子目录
- table 命名 SHALL 用 `{name}Table`（例：`usersTable`）
- 列定义 SHOULD 按字段角色分组：主键 → 业务字段 → 状态字段 → 时间戳
- 时间戳 MUST 使用 `timestamp(..., { withTimezone: true })`
- 主键 SHOULD 用 `uuid().primaryKey().defaultRandom()`

## Relations

- 所有表关系 MUST 集中声明于 `relations.ts`，MUST NOT 散落在 schema 文件
- 关系命名 SHALL 用 `{table}Relations`（例：`usersRelations`）
- schema 删除 / 重命名 MUST 同 PR 更新 `relations.ts`

## Imports

- schema 之间引用 MUST 使用相对路径（drizzle-kit 不解析 path alias）
- 跨 package 消费 MUST 通过 `@workspace/database` package entry，MUST NOT 直接 import schema 文件
- `index.ts` barrel 仅在 package 出口（`src/index.ts` / `schemas/index.ts` / 子目录 `index.ts`）使用

## Schema Change Workflow

```bash
# 1. 编辑 packages/database/src/schemas/
# 2. 重建以让下游 package 看到新类型
pnpm --filter @workspace/database build
# 3. Dev：直接 push schema
pnpm --filter @workspace/database db:push
# 4. Prod：生成 migration 文件
pnpm --filter @workspace/database db:generate
```

下游 package 消费新类型前 MUST 完成 build。

## Anti-patterns

- MUST NOT 在本 package 内写业务逻辑（仅 schema + relations + 迁移脚本）
- MUST NOT 手改 `drizzle/` 下的 migration 文件
- MUST NOT 在 schema 或 config 中硬编码连接字符串
- MUST NOT 在 schema 文件内写 relations
- MUST NOT 跳过 build 步骤直接消费新类型
- MUST NOT 在业务 package 内 import 具体 schema 文件路径

## Human-in-the-loop

- schema 涉及 Better Auth 字段变更 — 兼容性影响判定，停下确认
- 字段变更需要数据迁移脚本（非纯 DDL）— 数据迁移策略决策
- 引入新数据库类型（jsonb / vector / postgis）— 类型扩展决策
