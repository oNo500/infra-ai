---
paths:
  - "src/**/*.{ts,tsx}"
  - "app/**/*.{ts,tsx}"
  - "components/**/*.{ts,tsx}"
  - "features/**/*.{ts,tsx}"
---

# Frontend Rules

## Architecture: Feature-Based

业务逻辑按功能模块内聚，跨 feature 的共享代码提升到顶层共享目录。

```
src/
├── app/              # Next.js App Router（仅路由，无业务逻辑）
├── features/         # 按功能划分的业务模块
│   └── <name>/
│       ├── components/   # 该 feature 的子组件（可选）
│       ├── hooks/        # 该 feature 的 hooks（可选）
│       ├── utils/        # 该 feature 的工具函数（可选）
│       ├── api/          # 数据获取与 API 调用（可选）
│       ├── types.ts      # 该 feature 的类型定义（可选）
│       └── <entry>.tsx   # feature 入口组件
├── components/       # 跨 feature 共享组件
├── hooks/            # 跨 feature 共享 hooks
├── lib/              # 第三方库封装（axios 实例、dayjs 配置等）
├── utils/            # 纯工具函数（与第三方库无关）
└── config/
    ├── env.ts        # 环境变量集中管理（必须）
    └── app-paths.ts  # 路由路径集中管理（必须）
```

- `app/` 下的页面文件只做路由编排：导出 metadata、dynamic 配置、组合 feature 组件。业务逻辑和 JSX 结构下沉到 `features/`

## Naming

| 类型 | 约定 | 示例 |
|------|------|------|
| 文件 / 目录 | kebab-case | `user-profile.tsx`, `auth-provider/` |
| 组件（代码中） | PascalCase | `UserProfile`, `AuthProvider` |
| 函数 / 变量 | camelCase | `getUserData`, `isAuthenticated` |
| 类型 / 接口 | PascalCase | `User`, `AuthConfig` |
| 常量 | UPPER_SNAKE_CASE | `API_BASE_URL`, `MAX_RETRIES` |
| `lib/` | — | 对第三方库的封装 |
| `utils/` | — | 纯工具函数，与第三方库无关 |

## 禁止行为

- 禁止在 `app/` 路由文件中写业务逻辑或复杂 JSX（下沉到 `features/`）
- 禁止在 `features/` 目录中使用 `index.ts` barrel 文件；直接从源文件导入
- 禁止任何 `eslint-disable`、`@ts-ignore`、类型断言绕过
- 禁止在组件中硬编码路由路径（使用 `config/app-paths.ts`）
- 只按需创建子目录，不预建空目录
