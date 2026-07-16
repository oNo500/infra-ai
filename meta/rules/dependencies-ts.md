---
name: dependencies-ts
status: ready
scope: global
tags: [ts]
---

# 元指令：dependencies-ts rule

TS/JS 生态的依赖与工具链选型，global 落点（是否装入项目由 profile 决定，
装入后无条件加载）。

## 目标

把 constitution 的 Library-First 落到 TS/JS 的具体倾向：选什么、按什么
顺序选。global 落点必须极简，只写选型方向不写用法。

## 约束（素材，构建时组织成产物）

- 依赖即债务：引入前先确认项目内无等效库（constitution 已有此句，
  本 rule 承接「确认之后选哪个」）
- 选包看 e18e 生态（e18e/awesome 找轻量替代），同类之间优先小而精
- 工具链优先 UnJS 系（unbuild、nitro、h3、consola、ofetch、ohash、defu）
- Pure ESM：拒绝 dual package hazard；唯一豁免是必须接 CJS-only 的
  legacy 包
- 运行时数据校验默认 zod：env、HTTP 请求、表单、第三方 API 响应等
  untrusted 边界一律 parse 后再用
- dev 工具链：lint/format 用 oxlint + oxfmt（不用 ESLint + Prettier 组合）、
  type check 用 `tsc --noEmit`、架构边界（feature 隔离、依赖单向、
  循环依赖检测）用 dependency-cruiser
- 包管理用 pnpm（硬链接、无幻影依赖、workspace 原生）+ corepack
  锁定 `packageManager` 字段；依赖健康三件套：syncpack 查版本一致性、
  taze 更新、knip 查未使用依赖
- SemVer 范围策略：应用用 `^`、发布的库用 `~`、关键基础设施精确锁定

## 产物要求

- global 落点：不超过 15 行正文，一条一行，姿态化
- 素材源：notes 仓 `20-areas/20-05-rc/rc-stack.md`、`rc-rules.md`、
  `10-projects/10-06-boilerplate/CodeStyle-约定.md`；前身是本仓
  dependencies rule（2026-07-16 拆分，AI SDK 条拆往 ai-sdk）
