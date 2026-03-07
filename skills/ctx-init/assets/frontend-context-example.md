# MyApp - Project Context

## Project Overview

面向个人用户的任务管理工具，支持多设备同步与团队协作。

**Type**: Web App

**Runtime**: Bun | **Package Manager**: pnpm

## Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL · Drizzle ORM
- **Auth**: Better Auth
- **UI**: Tailwind CSS · shadcn/ui
- **Testing**: Vitest · Playwright
- **Toolchain**: pnpm · ESLint · GitHub Actions

## Architecture

Feature-Based Architecture：业务逻辑按功能模块内聚，跨 feature 的共享代码提升到 `components/`、`hooks/`、`lib/`、`utils/`。

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


### Feature 内部结构

```
src/features/<name>/
  components/   # 该 feature 的子组件（可选）
  hooks/        # 该 feature 的 hooks（可选）
  utils/        # 该 feature 的工具函数（可选）
  api/          # 数据获取与 API 调用（可选）
  types.ts      # 该 feature 的类型定义（可选）
  <entry>.tsx   # feature 入口组件，直接导出，不用 barrel
```

只按需创建子目录，不预建空目录。

## Coding Conventions

### Naming

| 场景 | 约定 | 示例 |
|------|------|------|
| 文件 / 目录 | kebab-case | `user-profile.tsx`, `auth-provider/` |
| 组件（代码中） | PascalCase | `UserProfile`, `AuthProvider` |
| 函数 / 变量 | camelCase | `getUserData`, `isAuthenticated` |
| 类型 / 接口 | PascalCase | `User`, `AuthConfig` |
| 常量 | UPPER_SNAKE_CASE | `API_BASE_URL`, `MAX_RETRIES` |

### lib/ vs utils/

| 目录 | 用途 |
|------|------|
| `lib/` | 对第三方库的封装（axios 实例、dayjs 配置等） |
| `utils/` | 纯工具函数，与第三方库无关 |

### TypeScript

- 禁止双重类型断言（`value as X as Y`）；出现双重断言说明存在类型不匹配，应从设计层面修复

### File Organization

- 测试文件与源文件并置：`foo.tsx` + `foo.test.tsx` 放在同一目录
- 跨模块端到端测试放在 `__tests__/e2e/`
- feature 目录中禁止使用 `index.ts` barrel 文件；直接从源文件导入
- 只按需创建子目录，不预建空目录

### Comments

- 注释说明"为什么"，不说明"是什么"
- 不写显而易见的注释
- 不为未修改的函数添加文档注释

## Development Workflow

### 初始化项目
```bash
pnpm install
cp .env.example .env
pnpm dev
```

### 开发新功能
```bash
git checkout -b feat/[name]
pnpm dev
pnpm test
pnpm lint:fix && pnpm typecheck
```

### 提交前检查
```bash
pnpm lint:fix
pnpm typecheck
pnpm test
```

### 生产构建
```bash
pnpm build
pnpm start
```

## Testing Rules

- **MUST write tests before implementation (TDD)**
- **Unit tests colocated with source; e2e tests in `__tests__/e2e/`**

```bash
pnpm test
pnpm test:e2e
```

## Modification Rules

- **MUST read the file before editing**
- **Prefer editing existing files over creating new ones**
- **Confirm before irreversible operations (delete, force push)**
