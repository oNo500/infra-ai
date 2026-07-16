---
name: database
status: ready
scope: global
tags: [ts, backend]
---

# 元指令：database rule

数据库与 ORM 的选型与迁移纪律。global 落点（由后端 profile 选入，
装入后无条件加载），产物必须精简。

## 约束（素材，构建时组织成产物）

- Drizzle 是 TS 端主线 ORM——SQL 透明可见，区别于 Prisma 的黑箱抽象；
  边缘运行时（edge）必选 Drizzle
- 选型决策：新项目快速迭代可用 Prisma；NestJS + 复杂业务用 Drizzle；
  老项目 TypeORM 不强行迁移
- 迁移纪律（红线）：`drizzle-kit generate` 的产物（SQL + `_meta/` 快照）
  MUST 提交 git；`push` 仅限本地原型，生产环境 MUST NOT 用
- 分页：游标分页优于偏移分页——OFFSET 随页深线性变慢且并发下漂移
- SQLite 生产纪律：`PRAGMA journal_mode = WAL` + `synchronous = NORMAL`

## 产物要求

- global 落点：不超过 12 行正文；迁移红线给正/反例（命令级）
- 素材源：notes 仓 `20-areas/20-04-tech-tree/databases/DB-Drizzle.md`、
  `DB-ORM选型.md`、`DB-SQLite与本地优先.md`
