# Architecture

本项目后端架构说明。受众：AI agent（写代码或做架构判断时参考）。与 `.claude/rules/api.md` 分工：rules 是执行期硬约束（自动加载），本文是深层原理（Claude 遇到 rules 没覆盖的场景时按需读）。

## 何时读这份文档

rules 没写、但 Claude 需要判断的场景：

- 用户让新建一个 context，判断起步阶段 / 判断要不要建 domain/
- 要抽共享契约，判断放 shared-kernel 还是留发布方 context
- 遇到 "A 需要 B 的数据、B 需要 A 的事件" 的双向依赖感
- 需要在多个 aggregate 之间做原子操作（事务）
- 发现规则和代码现状冲突，判断哪边是错的

其他情况按 `rules/api.md` 执行即可。

## 一、两套思想的叠加

本项目后端叠加了两套独立的思想：

### Clean Architecture：依赖向内

```
┌──────────────────────────────────────────────────┐
│  Frameworks & Drivers（NestJS / Drizzle / HTTP）  │
│  ┌────────────────────────────────────────────┐  │
│  │  Interface Adapters（Controller / DTO）     │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │  Application（Service / Use Case）   │  │  │
│  │  │  ┌────────────────────────────────┐  │  │  │
│  │  │  │  Domain（Aggregate / VO）      │  │  │  │
│  │  │  └────────────────────────────────┘  │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
       源码依赖箭头永远指向内层 ↗
```

核心规则：**内层不知道外层存在**。内层需要外层能力时，**内层定义接口，外层实现**（依赖倒置）。

### DDD 战术分层：同一思想的代码落地

Clean Architecture 的四圈映射到目录：

- Frameworks & Drivers → `app/`（NestJS 模块装配、全局 filter/interceptor/middleware）
- Interface Adapters → `modules/{ctx}/presentation/`（Controller + DTO）
- Application → `modules/{ctx}/application/`（Service + Port 接口）
- Domain → `modules/{ctx}/domain/`（Aggregate / Entity / Value Object / Event）

依赖方向严格单向：`presentation → application → domain`，`infrastructure` 实现 `application/ports` 定义的接口。

### 两套叠加后的一句话总结

**业务逻辑要能脱离 NestJS 框架独立存在**——架构上所有边界的存在都是为了守护这一点（演化、测试、替换都围绕这个目标）。

## 二、NestJS + TypeScript 如何守护这条线

DDD 和 Clean Architecture 都要求"依赖倒置"。但在 NestJS 的"自然用法"下，这件事**不会自动发生**——NestJS 鼓励类注入（`constructor(private db: DrizzleService)`），这直接把 application 层耦合到 infrastructure 层，方向反了。

项目用 TypeScript 的一个特性救回来：**编译期依赖和运行期依赖可以分开声明**。

### 分开的机制

- **编译期**：`import type { XPort } from '...'` —— 只给 tsc 和 IDE 看，编译后**完全擦除**，不进运行时模块图
- **运行期**：`@Inject(X_TOKEN)` —— Symbol 常量携带装配信息，不引入类引用

两者在代码里**同一个类的同一个字段**上协作：

```ts
import type { CachePort } from '@/shared-kernel/application/ports/cache.port'
import { CACHE_PORT } from '@/shared-kernel/application/ports/cache.port'

@Injectable()
class OrderService {
  constructor(
    @Inject(CACHE_PORT) private readonly cache: CachePort,
    //       ^^^^^^^^^^^                     ^^^^^^^^^^
    //       运行期装配                       编译期类型
  ) {}
}
```

**这是本项目所有依赖倒置的唯一落地手段**。三条硬约束（Symbol token / `import type` / 构造函数注入）都是为了让这套机制能跑起来：

- 用类做 DI key → `emitDecoratorMetadata` 会把类引用写进运行时元数据 → `import type` 失效，触发对具体类的 runtime import → 跨 context 循环依赖
- 运行期 `import { XPort }` interface → interface 编译后消失 → 运行时变量是 `undefined` → DI 解析失败
- property injection / `@Optional()` → 无法用 `new Service(...mocks)` 直接构造 → 必须启动 NestJS 容器才能单测

## 三、DDD 四层职责

### domain/

**职责**：纯业务逻辑。Aggregate / Value Object / Entity / Domain Event。

**约束**：
- 禁 `@Injectable` / `@nestjs/*` / 运行时库（`ioredis` / `pino` / `bcrypt` 等）
- 允许 import：本 context domain、`app/base/`（基类）、`shared-kernel/`（纯契约）
- `*.spec.ts` 只用 vitest + 本 context domain 类，**不启 NestJS 容器**

**为什么这么严**：domain 是最稳定的一层。你要能在 5 秒内跑完所有 domain 单测，不等容器启动。这条约束是整个架构**可测试性的底线**。

### application/

**职责**：编排业务流程。Service 不含复杂计算规则——像指挥官：
1. 调 Repository port 加载 aggregate
2. 调 aggregate 的业务方法（`order.pay()`）
3. 调 Repository port 保存

**约束**：
- 只依赖 domain + ports（不依赖 infrastructure 的具体实现）
- 禁注入具体客户端（`@Inject(DrizzleService)` 禁）
- 所有外部交互走 port 接口

**Port 归属**：
- 本 context 专用的 port → `modules/{ctx}/application/ports/`（例：`TODO_REPOSITORY`）
- 跨 context 消费的 port → `shared-kernel/application/ports/`（例：`CACHE_PORT`）
- 升级时机：第 2 个消费方出现时搬 shared-kernel

### infrastructure/

**职责**：脏活累活。数据库查询、外部 API 调用、消息队列、文件 IO——port 接口的**具体实现**。

**约束**：
- 实现 `application/ports` 定义的接口（依赖倒置的落地方）
- 禁做业务决策（业务判断留在 application 或 domain）
- 可以直接 import domain 类（持久化映射需要）

### presentation/

**职责**：HTTP 入口。接收请求、校验参数、调 Service、返回 DTO。

**约束**：
- 禁写业务判断（`if/else` 业务分支 → 下沉 Service）
- 必须返回 DTO（`XxxResponseDto` + 显式 `fromDomain()` 转换），禁 leak aggregate/entity
- 阶段 1-2 的简单 CRUD 可豁免 DTO 强制（直接返回 schema type）

## 四、跨 context 通信

NestJS 的 `@Module()` 依赖图在应用启动时解析，出现环 → 启动失败。所以跨 context **不能走 NestJS 的 imports**，只能走两种**技术上不会成环**的机制。

### 两把钥匙

**钥匙 1：port + Symbol token（同步，需返回值）**

```
consumer context          shared-kernel            provider context
┌──────────────┐         ┌───────────────┐        ┌──────────────┐
│ Service      │         │  CachePort    │        │ CacheAdapter │
│ @Inject      │ ──────> │  (interface)  │ <───── │ (implements) │
│ (CACHE_PORT) │         │  CACHE_PORT   │        │              │
└──────────────┘         │  (Symbol)     │        └──────────────┘
                         └───────────────┘
```

- 接口 + TOKEN 放 `shared-kernel/application/ports/`
- 实现方 module `@Global()` 暴露 TOKEN 绑定的 provider
- 消费方 `@Inject(TOKEN)` + `import type { Port }`，**不** import 实现方 module

**钥匙 2：domain event（异步，触发副作用）**

```
publisher context            event class                consumer context
┌──────────────┐            ┌──────────────┐           ┌──────────────┐
│ aggregate    │            │ UserCreated  │           │ Listener     │
│ addDomainEv  │ ─publish─> │ Event        │ ─import─> │ @OnEvent(    │
│              │            │ (纯数据类)   │           │  Event.name) │
└──────────────┘            └──────────────┘           └──────────────┘
```

- event 类在发布方 `domain/events/`（`extends DomainEvent`，零运行时依赖）
- 消费方 listener 直接 `import` event 类 + `@OnEvent(Event.name)`
- 发布方**不感知**消费方（发布时只 `addDomainEvent`，谁订阅不关心）

### 如何选择

| 场景 | 用哪个 | 为什么 |
|---|---|---|
| 需要返回值 | port | event 是发布后不管 |
| 需要事务原子 | port | event listener 可能异步执行 |
| 写完触发旁路逻辑（审计、通知、缓存失效） | event | 发布方不应该知道有这些旁路 |
| 多个 context 对同一事件做不同反应 | event | 一事件多消费方 |

### 禁区

- `forwardRef()` 绕循环 → 边界划错，停下找用户确认边界
- 双向事件订阅（A 订 B + B 订 A） → 边界划错
- 跨 context import 对方 Service 具体类 / module / infrastructure → 违反编译期/运行期分离

**边界划错怎么办**：停下，把"A 和 B 到底谁依赖谁"写给用户。通常解法是抽第三个 context 持有共享概念，或者合并 A 和 B（如果它们本来就是一个业务单元）。

## 五、共享契约的归属

### shared-kernel 的来历

DDD 原著里 Shared Kernel 是 bounded context 之间共享 domain model 的合法模式，但 Evans 警告它容易腐化。我们项目的 `shared-kernel/` **不放 domain model**——只放契约和纯工具级数据结构。

### 为什么必须存在

TypeScript + NestJS 的依赖模型下：

- 消费方 import 发布方的接口文件 → 触发对发布方 module 的依赖
- 两个 context 想互相用对方的接口 → 循环依赖 → 启动失败

所以接口必须放**中立地带**让双方都能安全 import。shared-kernel 就是这个中立地带。

### 准入两类

**一、跨 context 契约**（由消费方数量决定）：
- port interface
- domain event 基类 / integration event 基类（见下）
- 全局 enum / 常量（`error-code.ts`）
- 跨 context 值对象（`role.vo.ts` 这类纯数据）
- 通用 DTO 基类（`list-response.dto.ts` / pagination DTOs）

**二、框架级基建**（仅被 `app/` 全局组件消费）：
- `problem-details.dto.ts`（全局异常 filter 用）
- `api-problem-responses.decorator.ts`（Swagger 装饰器）

### 禁区

- **context 特定的业务判断**（例：`Order.canCancel()` 的方法实现）
- **带业务方法的 entity 或 domain service**（可以有值对象，但方法要对所有 context 语义一致）
- **运行时可变状态**（单例、全局变量、模块级可变常量）
- **通用工具函数**（放 `app/utils/` 或本 context）

### 腐化预警

- shared-kernel 里的 port 接口方法持续增长 → 按消费场景拆多个 port（ISP：接口隔离原则）
- 出现 "只有 X context 会用这个字段" → 该字段不属于 shared-kernel
- 出现 "这个方法在 A context 和 B context 里语义不同" → 拆 context 各自实现

### 进入与离开

- **进入**：第 2 个消费方出现时搬 shared-kernel
- **离开**：消费方减到 1 个，搬回发布方 context（保持 shared-kernel 瘦身）
- **永远不进**：只有 1 个消费方的 port（例：`session-cleanup.port` 只给 scheduled-tasks 用 → 留 `auth/application/ports/`）

## 六、项目基座：`app/base/`

`app/base/` 放**让 DDD 在本项目跑起来的底座**：

- `BaseAggregateRoot`：提供 `addDomainEvent` / `getDomainEvents` / `clearDomainEvents`——让 infrastructure 层能统一收集和发布 aggregate 的事件
- `DomainEvent` 基类：所有 domain event 都 `extends` 它，提供 `occurredAt` 等共性字段
- `IntegrationEvent` 基类：区分"内部事件"和"发给外部系统的事件"

**为什么不放 shared-kernel**：这些是**项目的运行时底座**，是技术基础件，不是 bounded context 之间的业务协议。性质和 `app/config/` / `app/filters/` 更像——属于框架装配层。

**为什么允许 domain import 它**：`domain/` 层 **需要** `extends BaseAggregateRoot` 才能让事件机制跑起来。这是 modules 到 app 方向唯一的合法 import——因为基座不是业务代码，是技术底座。

### 未来可能的基座扩展

如果出现 ≥ 3 个 context 需要类似机制，可以加：
- `ValueObject<T>` 基类（统一 `equals()`）
- `Entity<TId>` 基类（统一 id + `equals by id`）
- `Specification<T>` 基类

加新基座的判断标准：infrastructure 层是否**必须以统一方式处理所有 context 的这类对象**？是 → 需要基座；否 → 每个 context 自己写。

## 七、渐进式分层（时间维度）

新 context 从薄壳起步，按信号升级。**不为"架构一致性"硬套 DDD，不为"未来扩展"预留空层。**

### 四阶段

| 阶段 | 结构 | 升级信号 | 项目例子 |
|---|---|---|---|
| 1 | presentation + infrastructure | 需持久化状态 | `health` / `upload` |
| 2 | + application/ports + repositories | "读→判断→写" 非平凡流程 | `todo` |
| 3 | + application/services | 状态转移规则 / 多字段一致性 / 需发布领域事件 | `analytics` |
| 4 | + domain/aggregates + events | — | `order` / `auth` / `identity` / `article` |

### 演化规则

- **默认起步阶段 1 或 2**
- **允许一次跳一阶**（1→2、2→3、3→4）
- **禁跳两阶**（1→3 或 2→4 必须停下问用户——这种跳跃往往意味着过度设计或没想清楚需求）
- **单向升级，禁降级**（降级往往丢业务语义，如果业务真简化了应该记录 ADR 而不是改代码）
- 阶段 2 允许 Controller 直接 `@Inject(REPOSITORY_TOKEN)`（不强制 Service 薄壳）

### 阶段 4 的进入特征

只有阶段 4 有 aggregate。进入阶段 4 的信号是**业务规则跨字段、跨请求、跨时间**——`Order` 的状态只能 `PENDING → PAID → SHIPPED`，不能跳；`Article` 只有 `published` 状态才能 `archive`。这种规则如果不用 aggregate 封装，会散落在多个 Service 方法里，一改就漏。

## 八、事务边界

事务边界 = 业务原子性边界。**在 application 层（Service）决定，不在 infrastructure 层**。

### 为什么不是 infrastructure 决定

Repository 的职责是"存取一个 aggregate"。它不知道"创建订单"这个 use case 是否要同时扣库存 / 写 audit log / 发 integration event。这些是**业务决策**，不是存取逻辑。

### 推荐模式：TransactionManager port

```ts
// shared-kernel/application/ports/transaction-manager.port.ts
export const TRANSACTION_MANAGER = Symbol('TRANSACTION_MANAGER')
export interface TransactionManager {
  runInTransaction<T>(fn: (ctx: TxContext) => Promise<T>): Promise<T>
}

// application/services/order.service.ts
async placeOrder(input) {
  return this.tx.runInTransaction(async (ctx) => {
    const order = Order.create(...)
    await this.orderRepo.save(order, ctx)
    await this.invRepo.reserve(order.items, ctx)
    return order
  })
}
```

- `TransactionManager` 是 port，接口不提及 Drizzle
- 实现在 `app/database/` 或 `infrastructure/`，用 Drizzle 的 `db.transaction()`
- Repository 方法接受可选 `ctx` 参数；Service 决定是否传入

### 禁用 `@Transactional()` 装饰器的理由

装饰器把事务边界隐藏到元数据，review 代码时看不到范围。显式 `runInTransaction(async (ctx) => ...)` 块把事务边界**做成代码结构**。

### Outbox 模式（涉及外部系统时）

**禁**把对外部系统的调用放进本地事务（外部宕机会回滚本地事务）。改用 outbox：

```ts
await this.tx.runInTransaction(async (ctx) => {
  await this.orderRepo.save(order, ctx)
  await this.outboxRepo.append(OrderCreatedIntegrationEvent, ctx)  // 同事务写 outbox
})
// 事务外，后台 worker 扫 outbox 发外部
```

当前项目未必实现 outbox——遇到需求时先停下问用户要不要引入。

## 九、关键决策的快速查找

| 问题 | 去哪找答案 |
|---|---|
| 某条规则的具体禁令 | `rules/api.md`（执行手册） |
| 为什么这样设计 | 本文 |
| 基座已有什么 / 要不要加新基座 | 本文 §六 |
| 共享契约放哪 / 什么时候搬 | 本文 §五 |
| 跨 context 通信选哪种 | 本文 §四 |
| 新 context 从哪一阶起步 | 本文 §七 |
| 事务跨越多个 aggregate | 本文 §八 |
| 代码和规则冲突 | 先信代码现状（git log 有意图），代码反模式再按规则修 |

## 十、架构的不变量

下面几条是本项目架构的**红线**。违反任何一条都意味着架构被破坏，必须停下重新评估：

1. domain 层零运行时依赖（除 `app/base/` 基座外）
2. 跨 context 通信只能走 port / event，不能 import 对方实现
3. 依赖方向单向：`presentation → application → domain`；`infrastructure` 实现 `application/ports`
4. DI 容器的装配只通过 `{ provide: SYMBOL_TOKEN, useClass: Impl }`，禁用类做 injection key
5. 业务逻辑能脱离 NestJS 容器单测（`new Service(...mocks)` 直接构造）

这些不变量的共同目的：**让核心业务代码不被外围技术栈污染**——NestJS 换成 Express / Drizzle 换成 Prisma / REST 换成 tRPC，domain 层都应该零改动。
