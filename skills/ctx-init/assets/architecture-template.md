# [PROJECT_NAME] - Architecture

## Tech Stack

- **Runtime**: [Runtime]
- **Framework**: [Framework]
- **Language**: TypeScript
- **Database**: [Database · ORM]
- **Testing**: [Testing framework]
- **Toolchain**: [Package manager · Linter · CI]

## Architecture

[描述整体架构模式，例如：Feature-Based、分层架构等]

```
src/
├── [directory]/    # [说明]
├── [directory]/    # [说明]
└── [directory]/    # [说明]
```

[补充关键的架构约定，例如依赖方向规则]

## Coding Conventions

### Naming

| 类型 | 约定 | 示例 |
|------|------|------|
| 文件 / 目录 | kebab-case | `user-profile.ts` |
| 类 / 接口 | PascalCase | `UserService` |
| 函数 / 变量 | camelCase | `getUserData` |
| 常量 | UPPER_SNAKE_CASE | `API_BASE_URL` |

### File Organization

- 测试文件与源文件并置：`foo.ts` + `foo.test.ts` 放在同一目录
- 只按需创建子目录，不预建空目录

### TypeScript

- 禁止双重类型断言（`value as X as Y`）
- 禁止 `eslint-disable`、`@ts-ignore`

### Comments

- 注释说明"为什么"，不说明"是什么"
- 不写显而易见的注释
