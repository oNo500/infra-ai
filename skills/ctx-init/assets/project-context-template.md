# [PROJECT_NAME] - Project Context

## Project Overview

[PROJECT_DESCRIPTION]
<!-- 1-3 句话：项目用途、目标用户、核心价值 -->

**Type**: [PROJECT_TYPE]
<!-- 示例：Web App、CLI Tool、npm Library、API Server、Monorepo -->

**Runtime**: [RUNTIME] | **Package Manager**: [PACKAGE_MANAGER]

## Tech Stack

<!-- 从 package.json 扫描，按 MECE 原则分类，忽略版本号，示例：
- **Runtime**: Node.js / Bun
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL · Drizzle ORM
- **Auth**: Better Auth
- **UI**: Tailwind CSS · shadcn/ui
- **Testing**: Vitest · Playwright
- **Toolchain**: pnpm · tsdown · ESLint · GitHub Actions
-->

## Architecture

<!-- 根据项目类型，选择对应架构模式组织目录结构：

前端（Feature-Based）：
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

CLI Tool：
src/
├── commands/         # 每个子命令一个文件
├── core/             # 核心业务逻辑
├── utils/            # 工具函数
└── config/
    └── env.ts        # 环境变量集中管理
-->

## Coding Conventions

### Naming

<!-- 用户未指定时，默认使用以下命名约定：
| 场景 | 约定 | 示例 |
|------|------|------|
| 文件 / 目录 | kebab-case | `user-profile.tsx`, `auth-provider/` |
| 组件（代码中） | PascalCase | `UserProfile`, `AuthProvider` |
| 函数 / 变量 | camelCase | `getUserData`, `isAuthenticated` |
| 类型 / 接口 | PascalCase | `User`, `AuthConfig` |
| 常量 | UPPER_SNAKE_CASE | `API_BASE_URL`, `MAX_RETRIES` |
-->

### lib/ vs utils/

<!-- 默认：
| 目录 | 用途 |
|------|------|
| `lib/` | 对第三方库的封装（axios 实例、dayjs 配置等） |
| `utils/` | 纯工具函数，与第三方库无关 |
-->

### TypeScript

<!-- 默认：
- 禁止双重类型断言（`value as X as Y`）；出现双重断言说明存在类型不匹配，应从设计层面修复
-->

### File Organization

<!-- 默认：
- 测试文件与源文件并置：`foo.tsx` + `foo.test.tsx` 放在同一目录
- 跨模块端到端测试放在 `__tests__/e2e/`
- feature 目录中禁止使用 `index.ts` barrel 文件；直接从源文件导入（原因：barrel 文件形成隐藏的 re-export 链，增加 tree-shaking 和重构复杂度）
- 只按需创建子目录，不预建空目录
-->

### Comments

<!-- 默认：
- 注释说明"为什么"，不说明"是什么"
- 不写显而易见的注释
- 不为未修改的函数添加文档注释
-->

## Development Workflow

<!-- 按 MECE 原则梳理开发场景，每个场景是一组有序步骤，示例：

### 初始化项目
```bash
pnpm install        # 安装依赖
cp .env.example .env  # 配置环境变量
pnpm dev            # 启动开发服务器
```

### 开发新功能
```bash
git checkout -b feat/[name]
pnpm dev            # 开发
pnpm test           # 验证
pnpm lint:fix && pnpm typecheck  # 质量检查
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
-->

## Testing Rules

- **[TESTING_RULE_1]**
<!-- 示例："MUST write tests before implementation (TDD)" -->
- **[TESTING_RULE_2]**
<!-- 示例："Unit tests colocated with source; integration tests in tests/" -->
- **[TESTING_RULE_3]**

```bash
# Run all tests
[TEST_COMMAND]

# Run specific test
[TEST_FILTER_COMMAND]
```

## Modification Rules

- **[MODIFICATION_RULE_1]**
<!-- 示例："MUST read the file before editing" -->
- **[MODIFICATION_RULE_2]**
<!-- 示例："Prefer editing existing files over creating new ones" -->
- **[MODIFICATION_RULE_3]**
<!-- 示例："Confirm before irreversible operations (delete, force push)" -->
