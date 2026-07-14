---
name: dependencies
status: ready
scope: global
---

# 元指令：dependencies rule

依赖与选型偏好，global 无条件加载。

## 目标

把 constitution 的 Library-First 从理念落到具体倾向：选什么、按什么顺序选。
global 落点，必须极简，只写选型方向，不写用法。

## 约束（素材，构建时组织成产物）

- 依赖即债务：引入前先确认项目内无等效库（constitution 已有此句，
  本 rule 承接的是「确认之后选哪个」）
- 选包看 e18e 生态（e18e/awesome 找轻量替代），优先小而精
- TS/JS 工具链优先 UnJS 系（unbuild、nitro、h3、consola、ofetch、ohash、defu）
- Pure ESM：拒绝 dual package hazard；唯一豁免是必须接 CJS-only 的 legacy 包
- 运行时数据校验默认 zod：env、HTTP 请求、表单、第三方 API 响应等
  untrusted 边界一律 parse 后再用
- AI 应用生产落地默认 Vercel AI SDK（多 provider 切换、streaming UI）
- TS 项目 dev 工具链：oxlint + oxfmt（不用 ESLint + Prettier 组合）、
  type check 用 `tsc --noEmit`、架构边界（feature 隔离、依赖单向、
  循环依赖检测）用 dependency-cruiser

## 产物要求

- global 落点：不超过 15 行正文，一条一行，姿态化
- 素材源：notes 仓 `20-areas/20-05-rc/rc-stack.md`、`rc-rules.md`、
  `10-projects/10-06-boilerplate/CodeStyle-约定.md`
