---
paths:
  - "src/**/*.ts"
---

# Backend Rules (NestJS)

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

**数据库（Drizzle）黄金规则：Service 层禁止直接注入 Drizzle，必须通过 Repository 接口。**

```typescript
// ✓ 正确：Repository 实现层注入 Drizzle
@Injectable()
export class DrizzleOrderRepository implements OrderRepository {
  constructor(@Inject(DB_TOKEN) private db: DrizzleDb) {}
}

// ✗ 错误：Service 层直接注入 Drizzle
@Injectable()
export class OrderService {
  constructor(@Inject(DB_TOKEN) private db: DrizzleDb) {} // 违反 DIP
}
```

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

## 禁止行为

- 禁止 Service 层直接注入 Drizzle
- 禁止 Controller 包含业务逻辑
- 禁止模块间直接 import（通过 shared-kernel 或领域事件解耦）
- 禁止简单 CRUD 强行创建 domain/ 层
- 禁止 Service 超过 10 个方法不拆分
- 禁止 domain/ 层依赖外部库
- 禁止任何 `eslint-disable`、`@ts-ignore`、类型断言绕过
- 导入路径必须使用 `@/*` 绝对路径别名
