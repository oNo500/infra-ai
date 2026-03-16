---
paths:
  - "src/**/*.ts"
---

# Backend Rules (NestJS)

## Tech Stack

- **Framework**: NestJS 11
- **Language**: TypeScript
- **Database**: PostgreSQL · Drizzle ORM（通过 `@workspace/database`）
- **Auth**: JWT + Passport · OAuth2（Google / GitHub）
- **Cache**: Redis · cache-manager · Keyv
- **Testing**: Vitest · @nestjs/testing · Supertest
- **Logging**: nestjs-pino · pino-http
- **HTTP**: class-validator · class-transformer · @nestjs/swagger · Scalar
- **Toolchain**: pnpm · ESLint · SWC

## Architecture: Modular Layered (DIP)

简单场景用贫血模型，复杂场景按需引入 DDD。

依赖方向（单向，无循环）：
```
presentation/ → application/services/ → application/ports/ ← infrastructure/
                      ↓
                   domain/（复杂场景才有）
```
- presentation 只能依赖 application/services
- application/services 只能依赖 application/ports 和 domain
- infrastructure 实现 application/ports 定义的接口
- domain 零外部依赖
- 禁止跨层跳跃，禁止反向依赖

```
src/
  ├── modules/{context}/
  │   ├── domain/                  # 仅复杂场景创建，零外部依赖
  │   │   ├── aggregates/
  │   │   ├── entities/
  │   │   ├── value-objects/
  │   │   └── events/
  │   ├── application/
  │   │   ├── ports/               # 接口定义，如 {context}.repository.port.ts
  │   │   └── services/            # 默认单文件；>10 个方法按场景拆分
  │   ├── infrastructure/
  │   │   └── repositories/        # 实现 ports 接口
  │   ├── presentation/
  │   │   ├── controllers/
  │   │   └── dtos/
  │   └── {context}.module.ts
  │
  ├── shared-kernel/
  │   ├── domain/                  # BaseEntity、Money 等
  │   └── infrastructure/          # DB、Logger、分页 DTO 等
  │
  └── app/                         # 横切关注点
      ├── config/
      ├── filters/
      ├── interceptors/
      └── middleware/
```

## Naming

| 场景 | 约定 | 示例 |
|------|------|------|
| 文件 / 目录 | kebab-case | `user-profile.dto.ts` |
| 类 / 接口 | PascalCase | `UserService`, `UserRepository` |
| 函数 / 变量 | camelCase | `findById`, `isActive` |
| 常量 | UPPER_SNAKE_CASE | `USER_REPOSITORY` |

## 关键规则

**数据库黄金规则：Service 层禁止直接注入数据库客户端，必须通过 Repository 接口。**

```typescript
// ✓ 正确：Repository 实现层注入数据库客户端
@Injectable()
export class OrderRepositoryImpl implements OrderRepository {
  constructor(@Inject(DB_TOKEN) private db: DatabaseClient) {}
}

// ✗ 错误：Service 层直接注入数据库客户端
@Injectable()
export class OrderService {
  constructor(@Inject(DB_TOKEN) private db: DatabaseClient) {} // 违反 DIP
}
```
### 数据库变更

```bash
# 1. 修改 packages/database/src/schemas/
# 2. 重新 build database 包
pnpm --filter @workspace/database build
# 3. 推送 schema 变更（开发环境）
pnpm --filter @workspace/database db:push
# 4. 或生成迁移文件（生产环境）
pnpm --filter @workspace/database db:generate
```

> 此示例使用通用命名；实际项目中 `DatabaseClient` 对应 Drizzle 的 `DrizzleDb`、Prisma 的 `PrismaClient` 等，原则相同。

**shared-kernel 准入规则（三条全满足才能放入）：**
1. Rule of Three：≥3 个模块以完全相同方式使用
2. 零业务语义：不含任何业务规则
3. 无条件分支：无 `if (context === 'user')` 类逻辑

## 新增模块/Feature 决策流程

### 1. 判断模块归属

| 情况 | 操作 |
|------|------|
| 属于已有限界上下文 | 添加到 `modules/{existing}/` |
| 新的独立业务概念 | 创建 `modules/{new}/` |
| 高度耦合、频繁共享 | 不应新建模块，划入同一上下文 |

### 2. 选择模型

**判断标准：是否包含复杂业务规则、不变量或跨实体协调？**

**贫血模型（默认选择）** — 适用：纯查询、简单 CRUD、无业务规则。

```typescript
// 无需创建 domain/ 层
@Injectable()
export class TodoService {
  constructor(@Inject(TODO_REPOSITORY) private repo: TodoRepository) {}

  async findAll() {
    return this.repo.findAll();
  }

  async create(dto: CreateTodoDto) {
    return this.repo.save(dto);
  }
}
```

**充血模型（按需引入）** — 适用：有业务规则、不变量、领域事件。Service 只做协调，不写业务逻辑。

```typescript
// 需要创建 domain/ 层
@Injectable()
export class OrderPlacementService {
  constructor(@Inject(ORDER_REPOSITORY) private repo: OrderRepository) {}

  async place(dto: PlaceOrderDto) {
    const order = OrderAggregate.create(dto);  // 业务规则在聚合根里
    return this.repo.save(order);
  }
}
```

### 3. 模块间通信（按优先级）

1. 领域事件（异步解耦）
2. shared-kernel 共享接口
3. REST API 调用

禁止直接跨模块 import 内部实现。

## 错误处理

全局过滤器执行顺序（注册顺序的反序）：

```
AllExceptionsFilter → ProblemDetailsFilter → ThrottlerExceptionFilter
```

所有错误统一转换为 RFC 9457 Problem Details 格式，字段：`type`、`title`、`status`、`detail`、`instance`、`request_id`、`timestamp`。


## 禁止行为

- 禁止 Service 层直接注入数据库客户端（Drizzle/Prisma/TypeORM 等）
- 禁止 Controller 包含业务逻辑
- 禁止模块间直接 import（通过 shared-kernel 或领域事件解耦）
- 禁止简单 CRUD 强行创建 domain/ 层
- 禁止 Service 超过 10 个方法不拆分
- 禁止 domain/ 层依赖外部库
- 禁止任何 `eslint-disable`、`@ts-ignore`、类型断言绕过
- 导入路径必须使用 `@/*` 绝对路径别名
- 私有字段，使用 `#` 语法，不使用 `_` 前缀
