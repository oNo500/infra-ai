---
name: nextjs
status: ready
scope: "**/*.tsx"
tags: [ts, frontend, nextjs]
requires: [react]
---

# 元指令：nextjs rule

Next.js App Router 专属约定，作用于 `**/*.tsx`。
通用 React 架构（feature-based、组件与类型、状态阶梯）归 react rule，
本 rule 只覆盖 Next.js 独有的结构决策。

## 约束（素材，构建时组织成产物）

- `app/` 只做路由编排：导出 metadata、dynamic 配置、组合 feature 组件
- 页面文件保持薄：业务逻辑与复杂 JSX 一律下沉到 `features/<name>/`
  （目录语义见 react rule，不重复）

## 产物要求

- scoped 落点；给一个薄页面文件的一行级正例
- 素材源：notes 仓 `10-projects/10-07-infra-ai/rules/frontend.md`
