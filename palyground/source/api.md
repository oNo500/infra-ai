---
paths:
  - apps/api/**
---

# API 规则（NestJS）

NestJS API 的架构规则：目录结构、分层职责、上下文边界、上下文间通信。

> **术语**
> - `context`（上下文）— `modules/` 下的一个目录，业务边界的基本单位
> - `Module` — NestJS 的 `@Module()` 装饰器，是实现机制而非边界

## 黄金法则

- **Service 禁止直接注入数据库客户端** —— 所有数据库访问必须经过 Repository port
- **上下文之间禁止互相 import** —— 仅通过 port 契约或事件契约通信

## 分层职责（单向、无环）

```
presentation/ → application/services/ → application/ports/ ← infrastructure/
                      ↓
                   domain/（仅复杂场景）
```

| 层 | 职责 | 禁令 |
|---|---|---|
| `app/` | 框架配置与横切关注点 | 禁止业务逻辑，禁止 import `modules/` |
| `presentation/` | 接收请求、校验、调用 Service、返回响应 | 禁止业务逻辑，禁止直连数据库 |
| `application/services/` | 编排业务流程、调用 port | 禁止直接注入数据库客户端 |
| `application/ports/` | 接口定义 | 实现由 `infrastructure/` 提供 |
| `domain/` | 业务规则、状态转移、领域事件 | 禁止依赖外部库 |
| `infrastructure/` | 实现 port、数据库查询、外部适配 | 禁止做业务决策 |
| `shared-kernel/` | 跨上下文契约与技术基类 | 禁止业务规则、禁止运行时状态、禁止具体实现 |

## 目录布局

```
src/
├── app/              # 框架配置与横切
├── modules/          # 限界上下文；彼此禁止互相 import
│   └── {context}/    # 见下方"上下文内部结构"
└── shared-kernel/    # 跨上下文契约
```

### 上下文内部结构

```
modules/{context}/
├── domain/           # 仅复杂场景；零外部依赖
│   ├── aggregates/
│   ├── entities/
│   ├── value-objects/
│   ├── enums/        # 使用 `as const` 模式
│   ├── events/
│   ├── services/     # 领域服务（纯业务逻辑）
│   └── factories/    # 可选
├── application/
│   ├── ports/        # {context}.repository.port.ts
│   ├── services/     # 默认单文件；方法 > 10 时按场景拆分
│   └── listeners/    # 领域/集成事件监听器
├── infrastructure/
│   ├── repositories/
│   └── adapters/     # 第三方 API、消息队列
├── presentation/
│   ├── controllers/
│   └── dtos/
└── {context}.module.ts
```

## 上下文边界决策

### 并入已有上下文

同时满足三条：

1. **同一聚合根**：新功能核心操作对象是本上下文已拥有的聚合根
2. **无新领域概念**：无需引入新实体/值对象，或新概念严格从属于已有聚合根
3. **职责不变**：用一句话描述该上下文的职责，加入新功能后这句话不变

### 新建上下文

满足任一条：

1. **独立聚合根**：拥有自己的聚合根，生命周期不依附于任何已有聚合根
2. **职责溢出**：并入后一句话的职责描述不再成立
3. **仅 ID 耦合**：只交换 ID，不共享领域对象

### 模糊场景决策流程

1. 用一句话写下目标上下文当前的职责
2. 并入新功能并重写职责
3. 句子变长或出现"和"连接异质概念 → 新建上下文
4. 句子不变 → 并入

**示例**：

```
auth 当前：管理用户登录、会话、OAuth
并入"通知"后：管理登录、会话、OAuth 和消息推送 ← "和"连接了异质概念
→ 新建 notification 上下文
```

## 上下文间通信

上下文之间禁止互相 import，仅两种通信渠道：

### Port 契约（同步，需要返回值）

- 接口定义在 `shared-kernel/application/ports/`
- 实现由拥有方上下文提供，通过 `@Global()` token 暴露
- 消费方用 `@Inject(TOKEN)` 注入，禁止 import 实现

### 事件契约（异步，产生副作用）

- 事件类定义在发布方的 `domain/events/` 下
- 发布方不感知消费方
- 消费方在自己的 `application/listeners/` 下声明 `@OnEvent()` 监听器

### 选择

| 场景 | 机制 |
|---|---|
| 需要返回值（同步查询） | Port 契约 |
| 触发副作用（异步反应） | 事件契约 |
| 多个上下文共享同一概念 | 抽为共享子域（独立上下文） |
| 出现双向依赖 | 边界划错，合并后重新拆分 |

## 共享子域

**三次法则**：当一个业务概念被 ≥ 3 个上下文依赖时，它不属于任何单一上下文，应抽为独立的共享子域。

**判断方法**：移除当前拥有该概念的上下文，其他上下文是否仍需要它？若需要，则是共享子域。

**示例**：`User` 身份数据被 auth、order、analytics 等多个上下文使用。它不归 auth 所有，而作为独立的 `identity` 上下文存在。

## Shared Kernel

### 准入规则

放入 `shared-kernel/` 的内容必须同时满足：

1. **三次法则**：被 ≥ 3 个上下文以相同方式使用
2. **零业务语义**：无业务规则；不按上下文分支
3. **只放契约**：接口、基类、通用 DTO；禁止具体实现

### `shared-kernel/` 布局

```
shared-kernel/
├── domain/
│   ├── base-aggregate-root.ts
│   ├── events/              # 领域事件基类
│   └── value-objects/       # 跨上下文值对象（Money、Address 等）
├── application/
│   └── ports/               # 跨上下文 port 接口
└── infrastructure/
    ├── dtos/                # 分页、通用响应 DTO
    ├── decorators/
    ├── enums/               # 全局错误码
    └── types/               # 跨上下文纯 TS 类型
```

## `@Global()` 白名单

仅以下模块允许使用 `@Global()`：

- `DrizzleModule`（`app/`）— token `DB_TOKEN`
- `cache` — token `CACHE_PORT`
- `audit-log` — token `AUDIT_LOGGER`
- `DomainEventsModule`（`app/`）

**附加约定**：

- 每个 `@Global()` 模块仅在 `AppModule` 中 import 一次
- Guard 定义在 `modules/auth/presentation/guards/`，在 `AppModule` 通过 `APP_GUARD` token 全局注册（见 `src/app.module.ts`），消费方通过 `@UseGuards()` 使用，无需 import `auth`

## 数据库 schema 变更流程

```bash
# 1. 修改 packages/database/src/schemas/
# 2. 重新构建 database 包
pnpm --filter @workspace/database build
# 3. 推送 schema 变更（开发环境）
pnpm --filter @workspace/database db:push
# 4. 或生成迁移（生产环境）
pnpm --filter @workspace/database db:generate
```

## 命名与代码约定

- 文件/目录：`kebab-case`，例 `user-profile.dto.ts`
- 类/接口：`PascalCase`，例 `UserService`、`UserRepository`
- 函数/变量：`camelCase`，例 `findById`、`isActive`
- 常量：`UPPER_SNAKE_CASE`，例 `USER_REPOSITORY`
- 绝对路径导入：使用 `@/*` 路径别名
- 私有字段：使用 `#` 语法，禁止 `_` 前缀

## 需判断类禁令

以下禁令需要结合上下文判断，无法完全交给静态分析：

- Controller 包含业务逻辑 → 下沉到 Service
- 为简单 CRUD 创建 `domain/` 层 → 先写 `application/services/`，真需要状态转移时再引入 `domain/`
- 在 `shared-kernel/` 中放具体实现 → 只允许接口、基类、通用 DTO
- 非白名单上下文使用 `@Global()` → 参见 `@Global()` 白名单
- Service 方法数 > 10 而不拆分 → 按场景拆分

## 参考实现

- Guard 全局注册：`src/app.module.ts`（`APP_GUARD` provider）
- Port 契约示例：`src/modules/auth/application/ports/`
- 事件发布/监听：`src/modules/order/application/listeners/`
- `@Global()` 模块：`src/app/database/`、`src/app/events/`

<!--
=== TODO: 静态分析覆盖 ===

当前 oxlint 已覆盖：
- unicorn/filename-case（文件名 kebab-case）
- eslint/max-lines-per-function（近似覆盖方法长度）

oxlint 暂不支持、需要补充的：
1. 方向性 import 约束（目录级）
   - 上下文间禁止互相 import
   - app/ 不得 import modules/
   - domain/ 不得依赖外部库
   - presentation/ 不得直连数据库
   → 计划引入 dependency-cruiser（`.dependency-cruiser.cjs`）

2. 命名约定（oxlint 尚未实现 typescript-eslint/naming-convention）
   - 类/接口 PascalCase、变量 camelCase、常量 UPPER_SNAKE_CASE
   - 私有字段 # 前缀
   → 暂以本规则文件 advisory 形式约束；oxlint 实现后迁移

3. 路径别名 @/* 强制
   - oxlint 暂无 no-relative-import-paths 对应规则
   → 可先用 no-restricted-imports + pattern 近似；彻底方案等上游实现

4. Service 注入 DB 客户端的检测
   - 可用 oxlint no-restricted-imports 禁 `**/services/**` 从 `@workspace/database` 直接 import
   → 待配置
-->
