---
paths:
  - "**/*.tsx"
---

# Next.js

Next.js App Router 专属结构约定。通用 React 架构（feature-based、目录语义、
状态管理阶梯）见 react rule，此处不重复。

## app/ 只做路由编排

- `app/` 内文件只承担路由职责：导出 `metadata`、`dynamic` 等路由配置，
  组合 `features/<name>/` 的组件
- 页面文件保持薄，业务逻辑与复杂 JSX 一律下沉到 `features/<name>/`——
  `app/` 的目录结构由 URL 决定，业务代码放在里面会随路由重构被迫搬家
  - 正：`export default function UsersPage() { return <UserList /> }`
