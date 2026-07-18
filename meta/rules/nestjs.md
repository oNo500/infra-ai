---
name: nestjs
description: NestJS 分层架构与 DIP 纪律（Repository 接口、模型选择、模块间通信）
status: ready
scope: "src/**/*.ts"
tags: [ts, backend, nestjs]
requires: [typescript]
---

# 元指令：nestjs rule

NestJS 后端的架构与分层纪律，作用于装了本 rule 的项目的 `src/**/*.ts`。

## 目标

覆盖 NestJS 项目里 Claude 无法从代码推断的分层决策与踩坑纪录。
具体技术栈（ORM、缓存、日志选型）随项目变化，不进 rule；
只写跨项目成立的架构原则。TS 类型纪律归 typescript rule，不重复。

## 约束（素材，构建时组织成产物）

分层（Modular Layered，DIP）：

- 依赖单向：presentation → application/services → application/ports ←
  infrastructure；domain 零外部依赖；禁止跨层跳跃与反向依赖
- 目录约定：`modules/{context}/` 下 domain（仅复杂场景）/ application
  （ports + services）/ infrastructure / presentation（controllers + dtos）；
  `shared-kernel/`；`app/` 放横切关注点（config、filters、interceptors、middleware）
- 数据库黄金规则：Service 层禁止直接注入数据库客户端（Drizzle/Prisma/
  TypeORM 等），必须通过 application/ports 定义的 Repository 接口，
  infrastructure 层实现——否则 DIP 失效、无法替换实现与单测
- shared-kernel 准入三条全满足才能放入：Rule of Three（≥3 个模块以完全
  相同方式使用）、零业务语义、无条件分支（无 `if (context === 'user')` 类逻辑）

模型选择：

- 贫血模型是默认（纯查询、简单 CRUD、无业务规则时不建 domain/）；
  禁止简单 CRUD 强行创建 domain/ 层
- 有业务规则、不变量、领域事件才引入充血模型：业务规则进聚合根，
  Service 只做协调
- Service 超过 10 个方法按场景拆分

模块间：

- 通信优先级：领域事件（异步解耦）> shared-kernel 共享接口 > REST 调用
- 禁止直接跨模块 import 内部实现

其他：

- Controller 不含业务逻辑
- 错误统一转 RFC 9457 Problem Details（type/title/status/detail/instance
  等字段）
- 踩坑纪录：NestJS 项目必须关闭 `typescript/consistent-type-imports`
  lint 规则——DI 在 constructor 参数依赖运行时类引用，规则会错误转成
  `import type` 导致 DI 失败
- 类私有字段用 `#` 语法，不用 `_` 前缀约定；constructor 参数属性
  （DI 注入）保留 `private readonly`——TS 参数属性语法不支持 `#`
- 导入用 `@/*` 别名

## 产物要求

- scoped 落点；依赖方向与目录约定用结构化 ASCII；数据库黄金规则给
  正/反例（注入位置对比）
- 素材源：notes 仓 `10-projects/10-07-infra-ai/rules/nestjs.md`、
  `10-projects/10-06-boilerplate/CodeStyle-约定.md`
