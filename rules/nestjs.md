# NestJS

NestJS 后端的架构与分层纪律。TS 类型与导入纪律见 typescript rule，此处不重复；
ORM、缓存、日志等具体选型随项目决定，不进本 rule。

## 分层架构（Modular Layered，DIP）

依赖单向，禁止跨层跳跃与反向依赖；domain 零外部依赖：

```
presentation → application/services → application/ports ← infrastructure
                        │
                        ▼
                     domain（零外部依赖）
```

目录约定：

```
src/
├── app/                    # 横切关注点：config、filters、interceptors、middleware
├── shared-kernel/          # 准入见下
└── modules/
    └── <context>/
        ├── domain/         # 仅复杂场景才建，见「模型选择」
        ├── application/
        │   ├── ports/      # Repository 等接口定义
        │   └── services/
        ├── infrastructure/ # ports 的实现（数据库、外部服务）
        └── presentation/
            ├── controllers/
            └── dtos/
```

- 数据库黄金规则：Service 层 MUST NOT 直接注入数据库客户端（Drizzle/Prisma/
  TypeORM 等），必须依赖 `application/ports` 定义的 Repository 接口，由
  infrastructure 层实现——直接注入令 DIP 失效，实现不可替换、Service 无法单测

  ```diff
  // application/services/user.service.ts
  - constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}
  + constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}
  ```

  `UserRepository` 接口放 `application/ports/`，`DrizzleUserRepository`
  在 `infrastructure/` 实现并注入 `DrizzleDb`。

- `shared-kernel/` 准入三条全满足才能放入，差一条就留在模块内：
  - Rule of Three：至少 3 个模块以完全相同方式使用
  - 零业务语义
  - 无条件分支（不含 `if (context === 'user')` 类逻辑）

## 模型选择

- 贫血模型是默认：纯查询、简单 CRUD、无业务规则时不建 `domain/`
- 出现业务规则、不变量或领域事件才引入充血模型：业务规则进聚合根，
  Service 只做协调
- Service 超过 10 个方法按场景拆分

## 模块间通信

- 优先级：领域事件（异步解耦）> shared-kernel 共享接口 > REST 调用
- 禁止直接跨模块 import 内部实现——需要共享的内容走上面的通信渠道

## Controller 与错误

- Controller 不含业务逻辑：只做参数校验、调用 service、组装响应
- 错误统一转 RFC 9457 Problem Details（`type`/`title`/`status`/`detail`/`instance`）

## 踩坑纪录

- MUST 关闭 `typescript/consistent-type-imports` lint 规则——NestJS DI 依赖
  constructor 参数的运行时类引用，该规则会将注入类错误转成 `import type`，
  类型擦除后 DI token 变 undefined，注入失败
- constructor 参数属性（DI 注入）保留 `private readonly` 写法——typescript rule
  的 `#` 私有字段约定不适用于此，TS 参数属性语法不支持 `#`
