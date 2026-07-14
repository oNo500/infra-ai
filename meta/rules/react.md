---
name: react
status: ready
scope: "**/*.tsx"
---

# 元指令：react rule

React / Next.js 前端的架构与组件约定，作用于 `**/*.tsx`。

## 目标

覆盖前端项目里 Claude 无法从代码推断的结构决策：feature-based 架构、
目录语义、组件类型习惯与状态管理阶梯。TS 类型纪律归 typescript rule，
不重复。

## 约束（素材，构建时组织成产物）

架构（feature-based）：

- 业务逻辑按功能内聚在 `features/<name>/`（components/hooks/utils/api/
  types.ts 均可选，按需创建，不预建空目录）
- `app/`（Next.js App Router）只做路由编排：metadata、dynamic 配置、
  组合 feature 组件；业务逻辑与复杂 JSX 一律下沉到 `features/`
- 跨 feature 共享才提升到顶层 `components/`、`hooks/`
- `lib/` 放第三方库封装（axios 实例、dayjs 配置）；`utils/` 放与第三方库
  无关的纯函数
- `config/env.ts` 集中环境变量；`config/app-paths.ts` 集中路由路径，
  组件内禁止硬编码路由
- `features/` 内禁止 barrel `index.ts`，直接从源文件导入——barrel
  掩盖真实依赖并放大打包体积

命名（文件 kebab-case 已是全局共识，此处重申代码内约定）：

- 组件、类型/接口 PascalCase；函数/变量 camelCase；常量 UPPER_SNAKE_CASE

组件类型习惯：

- 组件用函数声明 + Props 注解；不用 `React.FC`（隐式 children 行为已变、
  阻断泛型）
- Props 容器首选 `interface`（可 extends/声明合并）；联合、交叉、映射类型才用 `type`
- Context 用 `createContext<T | null>(null)` + 守卫 hook（缺 Provider 即抛错）；
  不用默认值兜底（缺 Provider 静默生效）、不用 `null!` 断言（运行时崩溃）

状态管理阶梯（升级需理由）：

- 跨 1-2 层 → props 直传
- 3+ 层且作用域有明确边界 → Context + 守卫 hook；单 Context 不装太多字段
  （任意字段变则全员重渲，按领域拆或拆 State/Dispatch）
- 全局、跨页面、高频变化 → 外部 store（Zustand/Jotai）
- 服务端数据 → TanStack Query 类缓存，不自己包 Provider 重新发明轮子

## 产物要求

- scoped 落点；架构部分给目录树（结构化 ASCII），约定给一行级正/反例
- 素材源：notes 仓 `10-projects/10-07-infra-ai/rules/frontend.md`、
  `20-areas/20-04-tech-tree/react/07-React-TypeScript实践.md`、
  `04-React-设计模式.md`
