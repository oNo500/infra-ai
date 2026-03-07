# [项目名称]

[1-2 句话描述这个 monorepo 的整体用途]

## 包结构

| 包/应用 | 路径 | 职责 |
|---------|------|------|
| [name] | `[packages/name]` | [一句话说明] |
| [name] | `[apps/name]` | [一句话说明] |
| [name] | `[libs/name]` | [一句话说明] |

> 各包/应用有独立的 `CLAUDE.md`，包含更详细的上下文。

## 统一命令

```bash
# 安装所有依赖
[install command, e.g. "pnpm install"]

# 构建所有包
[build command, e.g. "pnpm build" / "turbo build"]

# 运行所有测试
[test command, e.g. "pnpm test" / "turbo test"]

# 代码检查
[lint command, e.g. "pnpm lint" / "turbo lint"]
```

## 单独启动

```bash
# 启动 [包/应用名]
[command, e.g. "pnpm --filter @scope/name dev"]

# 启动 [包/应用名]
[command, e.g. "pnpm --filter @scope/name dev"]
```

## 开发工作流

### 新增功能

```bash
# 1. 确认影响范围（哪些包需要改动）
# 2. 在对应包目录下开发
# 3. 跨包联调
[command, e.g. "pnpm --filter @scope/name... dev"]

# 4. 在根目录统一运行测试
[test command]
```

## 跨包约束

- [约束 1，例如"所有包共享同一个 TypeScript 配置，禁止在子包中覆盖 strict 设置"]
- [约束 2，例如"包间依赖必须通过 workspace: 协议声明，禁止使用绝对版本号"]
- [约束 3，例如"公共工具函数统一放入 packages/utils，禁止在业务包中重复实现"]
