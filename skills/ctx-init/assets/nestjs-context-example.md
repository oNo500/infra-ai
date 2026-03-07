# MyAPI - Project Context

## Project Overview

基于 NestJS 的模块化分层架构，清晰分层 + 模块化边界，简单场景用贫血模型，复杂场景按需引入 DDD

**Type**: API Server

**Runtime**: Node.js | **Package Manager**: pnpm

## Tech Stack

- **Framework**: NestJS
- **Language**: TypeScript
- **Database**: PostgreSQL · Drizzle ORM
- **Testing**: Vitest
- **Toolchain**: pnpm · ESLint

## Architecture

模块化分层架构（DIP）：简单场景用贫血模型，复杂场景按需引入 DDD。

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
│   │   ├── events/
│   │   ├── enums/
│   │   ├── services/
│   │   └── factories/
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
│   ├── domain/                  # BaseEntity、Money、Address 等
│   └── infrastructure/          # DB、Logger、分页 DTO 等
│
└── app/                         # 横切关注点，不属于任何业务模块
    ├── config/
    ├── filters/
    ├── interceptors/
    ├── middleware/
    └── health/
```

## Coding Conventions

### 基本规则

| 规则 | 说明 |
|------|------|
| 导入路径 | 必须使用 `@/*` 绝对路径别名 |
| 文件命名 | `kebab-case`，如 `user-profile.dto.ts` |
| 类型安全 | 禁止 `any`，使用 `unknown` 或具体类型 |
| 私有字段 | 使用 `#` 语法，不使用 `_` 前缀 |
| 禁止绕过检查 | 禁止任何 `eslint-disable`、`@ts-ignore`、类型断言绕过，必须根本性修复 |
| 注释 | 禁止 emoji |

### Naming

| 场景 | 约定 | 示例 |
|------|------|------|
| 文件 / 目录 | kebab-case | `user-profile.dto.ts` |
| 类 / 接口 | PascalCase | `UserService`, `UserRepository` |
| 函数 / 变量 | camelCase | `findById`, `isActive` |
| 常量 | UPPER_SNAKE_CASE | `USER_REPOSITORY` |

### TypeScript

- 禁止双重类型断言（`value as X as Y`）
- 禁止 `any`，使用 `unknown` 或具体类型
- 私有字段使用 `#` 语法，不使用 `_` 前缀

### 数据库（Drizzle）

**黄金规则：Service 层禁止直接注入 Drizzle，必须通过 Repository 接口。**

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

### shared-kernel 准入规则

放入前必须全部满足：

1. **Rule of Three**：≥3 个模块以完全相同方式使用
2. **零业务语义**：不含任何业务规则或业务概念
3. **无条件分支**：代码中没有 `if (context === 'user')` 这类逻辑

**试金石**：删除所有业务模块后，这段代码是否仍有意义？否 → 不放入。

```
✓ 可以放入：BaseEntity、Money、DrizzleProvider、OffsetPaginationDto
✗ 禁止放入：UserAggregate、CreateUserDto、calculate-shipping-cost.ts、任何 utils
```

**演进信号**：一旦 shared-kernel 代码出现业务分支，立即复制回各模块，从 shared-kernel 删除。

### 模块间通信

```typescript
// ✗ 禁止：直接导入其他模块内部实现
import { UserService } from '@/modules/user/application/services/user.service';

// ✓ 正确：通过 shared-kernel 接口或领域事件解耦
```

跨模块通信方式（按优先级）：
1. 领域事件（异步解耦）
2. shared-kernel 共享接口
3. REST API 调用

### 异常处理

全局过滤器执行顺序（注册顺序的反序）：

```
AllExceptionsFilter → ProblemDetailsFilter → ThrottlerExceptionFilter
```

所有错误统一转换为 RFC 9457 Problem Details 格式，包含 `type`、`title`、`status`、`detail`、`instance`、`request_id`、`timestamp`。

### File Organization

- 测试文件与源文件并置：`foo.ts` + `foo.spec.ts`
- 禁止模块间直接导入，通过 `shared-kernel/` 或事件解耦

### Comments

- 注释说明"为什么"，不说明"是什么"
- 不写显而易见的注释

## Development Workflow

### 初始化项目
```bash
pnpm install
cp .env.example .env
pnpm start:dev
```

### 开发新功能
```bash
git checkout -b feat/[name]
pnpm start:dev
pnpm test
pnpm lint:fix
```

### 数据库迁移
```bash
pnpm db:generate   # 生成迁移
pnpm db:push       # 开发环境应用
pnpm db:migrate    # 生产环境应用
```

### 提交前检查
```bash
pnpm lint:fix
pnpm test
```

### 新增模块/features
1. 读懂依赖方向，依赖方向（单向，无循环）：

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
  

2. 判断模块归属

| 情况 | 操作 |
|------|------|
| 属于已有限界上下文 | 添加到 `modules/{existing}/` |
| 新的独立业务概念 | 创建 `modules/{new}/` |
| 高度耦合、频繁共享 | 不应新建模块，划入同一上下文 |

---

3. 选择模型

**判断标准：是否包含复杂业务规则、不变量或跨实体协调？**

### 贫血模型（默认选择）

适用：纯查询、简单 CRUD、无业务规则。

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

4. 充血模型（按需引入）

适用：有业务规则、不变量、领域事件。Service 只做协调，不写业务逻辑。

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

## Testing Rules

- **MUST write tests before implementation (TDD)**
- **Unit tests colocated with source**

```bash
pnpm test
pnpm test:e2e
```


## 参考模块

| 模块 | 模式 | 特点 |
|------|------|------|
| `modules/todo/` | 贫血模型 | 最简 CRUD，无 domain 层 |
| `modules/article/` | 充血模型 | DDD + 聚合根 + 领域事件 |
| `modules/order/` | 充血模型 | 幂等、乐观锁、异步、批量四大高级特性 |

---

## 提交前自检

```
□ domain/ 层无任何外部依赖
□ Service 层未直接注入 Drizzle
□ 模块间无直接 import
□ 简单 CRUD 没有强行创建 domain/ 层
□ shared-kernel 新增内容满足三条准入规则
□ Controller 无业务逻辑
□ 单个 Service 文件未超过 10 个方法
□ 新增环境变量已更新 env.schema.ts 和 .env.example
□ 集合 API 路由命名符合规范
□ 无 any、无 disable 注释、无类型断言绕过
```

---

## 禁止行为速查

```
✗ 简单 CRUD 强行 DDD
✗ domain/ 层依赖外部库
✗ Service 层直接操作 Drizzle
✗ Controller 包含业务逻辑
✗ 模块间直接 import
✗ shared-kernel 放入业务语义代码
✗ Service 超过 10 个方法不拆分
✗ 集合 API 自创路由命名
✗ 使用 any / eslint-disable / @ts-ignore
✗ 代码和注释中使用 emoji
```

## Modification Rules

- **MUST read the file before editing**
- **Prefer editing existing files over creating new ones**
- **Confirm before irreversible operations (delete, force push)**
