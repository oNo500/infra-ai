---
paths:
  - apps/api/**
---

# API 规则（NestJS + DDD）

自包含。Claude 在 `apps/api/**` 写代码按此执行。深层原理见 `docs/architecture.md`。

下方代码块为可复制规则,整块 copy 到目标项目的 `.claude/rules/api.md` 即可。

---

```markdown
## 目录分工

\`\`\`
src/
├── app/              # 框架装配 + 项目基座
│   ├── base/         # 基座:BaseAggregateRoot / DomainEvent / IntegrationEvent
│   ├── config/ database/ events/ filters/ interceptors/ middleware/ logger/
│   └── decorators/ validators/
├── modules/{ctx}/    # 业务上下文
└── shared-kernel/    # 跨 context 纯契约
\`\`\`

### 依赖方向

- `modules/` 的 `domain/` 允许 import `app/base/`(继承基类)
- `modules/` 的其他层允许 import `app/decorators/` / `app/validators/`
- `modules/` MUST NOT import `app/` 其他子目录(config / database / events 等装配代码)
- `app/` MUST NOT import `modules/`
- context 之间 MUST NOT 互相 import(例外见下方"跨 context 通信")
- `shared-kernel/` 只放纯契约,MUST NOT import `modules/` / `app/`

## domain 层纯度

domain 是业务语义的独立表达,框架与基础设施都不该污染它。

- 源代码 MUST NOT 出现 `@Injectable` / `@nestjs/*` / 运行时库(`ioredis` / `pino` / `bcrypt` / `date-fns`)
- 源代码允许 import:本 context `domain/`、`app/base/`、`shared-kernel/`
- `*.spec.ts` 仅用 `vitest` + domain 类;MUST NOT 用 `Test.createTestingModule`——domain 测试不该需要 NestJS 容器
- 聚合根模式:`load → aggregate.method() → repo.save()`;aggregate 暴露业务方法(`pay` / `cancel` / `publish`),MUST NOT 用字段 setter——setter 让外部直接改状态,绕过业务规则

遇阻:想在 domain 用外部库 → 该逻辑属于 application 或 infrastructure,停下挪出去。

## 跨 context 通信

context 之间通过显式契约通信,不直接 import 对方实现。NestJS DI + TypeScript `import type` 的组合让这件事在编译期与运行期都成立:

- 接口用 `import type` 导入(编译期擦除,不产生运行期依赖)
- 实现用 `@Inject(X_TOKEN)` 装配(运行期只引入 Symbol 常量,不引入类)

### 通信机制

按通信意图选机制:

- 需要返回值(同步) → port + Symbol token:`@Inject(X_TOKEN)` + `import type { XPort }`
- 触发副作用(异步) → domain event:`@OnEvent(XEvent.name)` + `import { XEvent }`

### DI 装配契约

NestJS DI 在以下三处违反时会装配失败或类型隔离破裂:

1. injection key MUST 用 `Symbol('NAME_TOKEN')`;MUST NOT 用类做 key——`emitDecoratorMetadata` 强制运行期 import 类,破坏类型隔离
2. 接口 MUST 用 `import type`;Symbol token 用普通 `import`——运行期 import interface 得到 `undefined`,DI 失败
3. MUST 构造函数注入;MUST NOT 用 `@Optional()` / property injection——后者让 `new Service(...mocks)` 单测不可用

### 合法 import 的位置

跨 context import 的合法位置只有两处:

- 跨 context 共享契约 → 走 `shared-kernel/`
  - `import { X_TOKEN } from '@/shared-kernel/application/ports/...'`(Symbol 常量,值)
  - `import type { XPort } from '@/shared-kernel/application/ports/...'`(接口,编译期擦除)
- 订阅另一 context 的 domain event → 直接 import 事件类
  - `import { YEvent } from '@/modules/{ctx}/domain/events/...'`(纯数据类,事件即已发生事实,订阅不产生反向耦合)

### 禁止的 import 与模式

- MUST NOT 跨 context import 对方 `services/` / `infrastructure/` / `{ctx}.module.ts`
- MUST NOT 跨 context import 对方 Service 具体类
- MUST NOT 用 `forwardRef()` 绕循环依赖——边界划错的信号
- MUST NOT 双向事件订阅(A 订 B、B 也订 A)——边界划错的信号

### `@Global()` 使用

凡 export 跨 context 消费 token 的 module MUST 加 `@Global()`。module 的 `exports` 可同时包含 Service 类和 TOKEN——Service 类给本 context 内部用,TOKEN 给跨 context 用。

遇阻:想 import 另一 context 某文件 → 检查是 `.port.ts` / `.event.ts` / `TOKEN` 还是 module/Service?后者禁止;判断不了停下问用户。

## 外部副作用走 port

数据库、缓存、外部 HTTP、消息队列、文件系统,以及 HTTP 入口/出口,通过 port 隔离——Service 不该知道自己用的是哪个数据库或哪个 HTTP 库,只知道一个抽象端口。

- Service 构造函数 MUST NOT 注入具体客户端:`@Inject(DrizzleService)` / `@Inject(Redis)` / `@Inject(HttpService)`
- Service 允许 `import type { InsertX, X } from '@workspace/database'`(纯类型)
- Repository 接口 → `application/ports/`,实现 → `infrastructure/repositories/`
- 外部 API → `application/ports/` + `infrastructure/adapters/`
- Controller 阶段 3+ MUST 返回 DTO(`XxxResponseDto` + `fromDomain()` 显式转换),MUST NOT leak aggregate/entity;阶段 1-2 简单 CRUD 可直接返回 schema type(见下方渐进分层)

遇阻:遇新外部副作用 → "能 mock 吗?能换实现吗?" → 走 port;本 context 无对应 port → 先建接口再停下问用户。

## shared-kernel 准入

shared-kernel 是 context 间共享契约的唯一通道,严格控制准入避免演化成"什么都往里扔"的杂物间。

允许准入的两类:

- 跨 context 契约:port 接口、domain event 类(`extends DomainEvent`)、全局 enum、通用 DTO 基类、跨 context 值对象(纯数据 class)
- 框架级基建:仅被 `app/` 全局组件消费的 DTO / decorator(`problem-details.dto.ts`)

MUST NOT 进入 shared-kernel:

- 任何 context 特定的业务判断
- 带业务方法的 entity / domain service(例:`Order.canCancel()`)
- 运行时可变状态(单例、全局变量)
- 工具函数(放 `app/utils/` 或本 context)

**进入时机**:第 2 个消费方出现时搬 shared-kernel。
**离开时机**:消费方减到 1 个,搬回发布方 context。
**腐化预警**:shared-kernel port 方法持续增长 → 按消费场景拆多个 port(ISP),不往胖 port 里加方法。

## 渐进式分层(时间维度)

context 从最薄壳起步,按信号升级。不为"架构一致性"硬套 DDD,不为"未来扩展"预留空层。

| 阶段 | 结构 | 升到下阶段信号 |
|---|---|---|
| 1 | presentation + infrastructure | 需持久化状态 |
| 2 | + application/ports + repositories | 出现"读→判断→写"非平凡流程 |
| 3 | + application/services | 出现状态转移规则、多字段一致性、或需发布领域事件 |
| 4 | + domain/aggregates + events | — |

- 默认起步阶段 1 或 2。用户没明说要 DDD 时不建 `domain/` / 不建 Service 薄壳
- 允许跳一阶;MUST NOT 跳两阶(1→3、2→4 停下问用户)
- 单向升级,MUST NOT 降级
- 阶段 2 允许 Controller 直接 `@Inject(REPOSITORY_TOKEN)`

遇阻:

- 建新 context → 问"有跨请求状态吗?"决定起步阶段
- 阶段 2 要加业务判断 → 先升 3 加 Service
- 阶段 3 要加状态机 → 升 4 信号,停下确认是否建 aggregate
- 用户说"拆 domain 简化" → 停下问原因,降级丢业务语义

## 命名与风格

由 `oxlint` + `dependency-cruiser` 兜底。Claude 写新文件前无需记忆约定,lint 报错再调整。配置见 `.oxlintrc.json` / `.dependency-cruiser.cjs`。

私有字段用 `#` 语法;绝对路径用 `@/*` 别名;`import type` 用于纯类型导入。
```
