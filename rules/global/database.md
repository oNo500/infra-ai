# Database

- TS 端主线 ORM 是 Drizzle——SQL 透明可见，区别于 Prisma 的黑箱抽象；边缘运行时（edge）MUST 用 Drizzle
- 选型：新项目快速迭代 MAY 用 Prisma；NestJS + 复杂业务用 Drizzle；老项目已用 TypeORM 不强行迁移
- 迁移红线：`drizzle-kit generate` 的产物（SQL 与 `_meta/` 快照）MUST 提交 git；`drizzle-kit push` 仅限本地原型，生产环境 MUST NOT 使用
  - 正：`drizzle-kit generate && git add drizzle/`，迁移文件随代码同 commit
  - 反：生产部署脚本里执行 `drizzle-kit push`
- 分页 SHOULD 用游标分页而非偏移分页——OFFSET 随页深线性变慢，且并发写入下结果漂移
- SQLite 生产环境 MUST 设 `PRAGMA journal_mode = WAL` 与 `synchronous = NORMAL`
