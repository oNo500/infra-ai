---
paths:
  - "**/*.tsx"
---

# React

React / Next.js 前端的架构与组件约定。TS 类型纪律见 typescript rule，此处不重复。

## 架构（feature-based）

```
src/
├── app/              # Next.js App Router：只做路由编排（metadata、dynamic 配置、组合 feature 组件）
├── features/
│   └── <name>/       # 业务逻辑按功能内聚；子目录按需创建，不预建空目录
│       ├── components/
│       ├── hooks/
│       ├── utils/
│       ├── api/
│       └── types.ts
├── components/       # 跨 feature 共享才提升到此，hooks/ 同理
├── hooks/
├── lib/              # 第三方库封装（axios 实例、dayjs 配置）
├── utils/            # 与第三方库无关的纯函数
└── config/
    ├── env.ts        # 环境变量集中于此
    └── app-paths.ts  # 路由路径集中于此
```

- 业务逻辑与复杂 JSX 一律下沉到 `features/<name>/`；`app/` 里的页面文件保持薄
- 路由路径从 `config/app-paths.ts` 导入，组件内不硬编码路径字符串
  - 正：`href={appPaths.userDetail(id)}`；反：`` href={`/users/${id}`} ``
- `features/` 内不建 barrel `index.ts`，直接从源文件导入——barrel 掩盖真实依赖并放大打包体积
  - 正：`import { UserCard } from "@/features/user/components/user-card"`；反：`import { UserCard } from "@/features/user"`

## 命名

- 组件、类型/接口 PascalCase；函数/变量 camelCase；常量 UPPER_SNAKE_CASE

## 组件与类型

- 组件用函数声明 + Props 类型注解，不用 `React.FC`——其隐式 children 行为随版本变动，且写不了泛型组件
  - 正：`function UserCard({ user }: UserCardProps) {`；反：`const UserCard: React.FC<UserCardProps> = ({ user }) => {`
- Props 容器首选 `interface`（可 extends、声明合并）；联合、交叉、映射类型才用 `type`
- Context MUST 用 `createContext<T | null>(null)` + 守卫 hook——默认值兜底会让缺
  Provider 静默生效，`createContext<T>(null!)` 断言则直接运行时崩溃；守卫 hook 把
  接线错误在最近处抛出
  - 守卫 hook：`const ctx = useContext(UserContext); if (!ctx) throw new Error("useUser must be used within UserProvider"); return ctx;`

## 状态管理阶梯

从最轻的方案开始，每次升级要有理由：

- 跨 1–2 层 → props 直传
- 跨 3+ 层且作用域有明确边界 → Context + 守卫 hook；单个 Context 不装过多字段——任一字段变化会让全部消费者重渲，按领域拆分或拆成 State/Dispatch 两个 Context
- 全局、跨页面、高频变化 → 外部 store（Zustand/Jotai）
- 服务端数据 → TanStack Query 类查询缓存，不自建 Provider 重新发明缓存
