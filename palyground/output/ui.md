---
paths:
  - packages/ui/**
---

# packages/ui 规则

`packages/ui/**` 全部代码 MUST 遵循本文件。

**架构基线**：shadcn 设计哲学（"copy not import"）+ Compound Component 模式 + Headless UI 分层（`@base-ui/react` 提供行为，本包提供样式与变体），落地于 React 19 + Tailwind CSS v4。

本文件遵循 RFC 2119 关键词：MUST / MUST NOT / SHOULD / SHOULD NOT / MAY。

执行任何代码写入前，AI MUST 在 `<architecture_thought>` 标签内评估当前任务，确认遵循路径后再编码。评估 MUST 覆盖：是否走 `shadcn cli` 安装、是否需要 `cva` 变体、是否需要 Compound Component 子部件、是否触发 §Human-in-the-loop。

## Tech Stack

- **Framework**: React 19
- **Headless Primitives**: `@base-ui/react` · `@radix-ui/*`
- **Styling**: Tailwind CSS v4 · `class-variance-authority` (cva) · `tailwind-merge` · `clsx`
- **Animation**: motion
- **Specialized**: sonner（toast）· vaul（drawer）· recharts（chart）· lucide-react（icons）
- **Theme**: next-themes
- **Validation**: zod

## 目录约定

```
packages/ui/
├── src/
│   ├── components/             # UI 组件
│   │   ├── <name>.tsx          # 单文件组件
│   │   └── <name>/
│   │       └── index.tsx       # 多文件组件（含子组件 / hooks / variants 拆分）
│   ├── hooks/                  # 跨组件共享 hooks
│   ├── lib/
│   │   └── utils.ts            # cn() 等工具函数
│   └── styles/
│       └── globals.css         # 全局 CSS 变量 + Tailwind 基础样式
├── components.json             # shadcn 配置
└── package.json                # exports 字段定义对外 API
```

## Component Authoring

### Component API

- 组件 SHALL 使用 `function Component(props)` 形式，MUST NOT 使用 `React.forwardRef`（React 19 已支持 ref 作为常规 prop）
- 组件 props 类型 SHALL extends 底层 primitive 的 Props 类型（例：`ButtonPrimitive.Props & VariantProps<typeof buttonVariants>`）
- 组件 SHALL 接受并 forward `className`，通过 `cn()` 合并外部样式与内部 variants

### Variants

- 多变体组件 MUST 使用 `cva` 定义 variants 与 defaultVariants
- variants 类型 SHALL 通过 `VariantProps<typeof xxxVariants>` 导出
- 单一形态组件（如 Separator / Skeleton）MAY 跳过 cva，直接 `cn()` 拼接

### Styling

- 类名合并 MUST 使用 `cn()`（来自 `@workspace/ui/lib/utils`），MUST NOT 直接拼接字符串
- 样式优先级：cva variants > 默认类名 > 外部 `className`（`tailwind-merge` 自动去重）
- 样式 SHALL 通过 Tailwind utility 表达，MUST NOT 写 inline style 或独立 CSS 文件（除 `globals.css`）

### Compound Components

- 组合型组件（Card / Dialog / Form 等）SHALL 拆分为 `Root` + 子部件（`<Card>` / `<CardHeader>` / `<CardContent>`）
- 子部件 MUST 通过具名导出，MUST NOT 通过 `Card.Header` 静态属性挂载

## Component Management

- 标准 shadcn 组件 MUST 通过 CLI 安装：`pnpm dlx shadcn@latest add <component>`
- shadcn 管理的组件文件（`components.json` 注册的）MUST NOT 手动新建或编辑
- 项目独有组件（非 shadcn 注册）SHALL 放 `src/components/`，复杂结构使用子目录 + `index.tsx`

## Exports

- 对外 API SHALL 通过 `package.json` exports 字段定义
- 路径约定：`@workspace/ui/components/<name>` / `@workspace/ui/hooks/<name>` / `@workspace/ui/lib/<name>` / `@workspace/ui/globals.css`
- MUST NOT 创建 barrel 文件（`index.ts` 聚合导出）

## Anti-patterns

- MUST NOT 使用 `React.forwardRef`（React 19 已废弃必要性）
- MUST NOT 在组件内直接拼接 className 字符串，MUST 用 `cn()`
- MUST NOT 引入业务逻辑（API 调用 / 状态管理 / 路由）至 `packages/ui`
- MUST NOT 在 `src/components/` 下创建 `index.ts` barrel
- MUST NOT 手动编辑 shadcn 注册的组件文件
- MUST NOT 在组件文件外部独立写 CSS（globals.css 除外）

## Human-in-the-loop

- 组件 API 偏离 `@base-ui/react` 默认契约（如自定义 children render）— 抽象层判定，停下确认
- 跨组件共享逻辑超出 `hooks/` 能承载（如需 Context Provider 链）— 架构演进决策
- 引入新 headless primitive 库（如 `@ariakit/react`）— 技术栈扩展决策

代码风格（命名约定 / 文件命名 / import 顺序）由 `oxlint` 强制。
