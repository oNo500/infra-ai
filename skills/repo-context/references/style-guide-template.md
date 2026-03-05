---
name: style-guide-template
description: .claude/docs/style-guide.md 的模板 - 代码风格与约定
---

# Style Guide 模板

用于生成 `.claude/docs/style-guide.md`。

该文件记录项目的代码风格约定 — 命名约定、代码模式等 linter 无法自动强制的规则。格式化规则（缩进、引号、分号等）交给 linter 处理，无需在此重复。

---

## 模板

```markdown
# [项目名称] - 代码风格

> AI 辅助开发的代码风格与约定。格式化规则由 linter 强制执行，此处仅记录命名、结构等需要人工遵守的约定。

## 命名约定

| 场景 | 约定 | 示例 |
|------|------|------|
| 变量/函数 | [例如 camelCase] | `userName`、`fetchData` |
| 类型/接口 | [例如 PascalCase] | `UserProfile`、`ApiResponse` |
| 常量 | [例如 UPPER_SNAKE] | `MAX_RETRIES` |
| 文件名 | [例如 kebab-case] | `user-profile.ts` |
| [场景] | [约定] | [示例] |

## TypeScript 约定

```typescript
// 对象类型优先使用 type
type User = {
  id: string
  name: string
}

// interface 仅用于可扩展的契约
interface Plugin {
  name: string
  setup(): void
}
```

[根据项目实际情况调整或替换]

## [框架] 约定

### [约定分类]

```[语言]
// 正确
[示例]

// 避免
[反模式]
```

### [约定分类]

```[语言]
[示例]
```

## 文件组织

- [规则，例如"每个文件一个组件"]
- [规则，例如"测试文件与源文件并置：`foo.ts` + `foo.test.ts`"]
- [规则，例如"barrel 导出（`index.ts`）仅用于公共 API"]

## 注释规范

- [规则，例如"JSDoc 仅用于公共 API 函数"]
- [规则，例如"不写显而易见的注释 — 注释说明'为什么'，不说明'是什么'"]
- [规则，例如"TODO 注释必须包含 issue 编号：`// TODO(#123): ...`"]

## Linter 强制执行的规则

项目使用 [ESLint/Biome 等]，关键规则如下：
- [关键规则及其作用]
- [关键规则]

提交前运行 `[lint 命令]`。
```

---

## AI 填写指南

- **不记录 linter 能强制的规则** — 缩进、引号、分号、行宽、导入顺序等由 linter 处理，不在此文件中重复
- **从现有代码中推断命名约定** — 若无明确文档，查看现有源文件的模式
- **只记录 linter 无法强制的内容** — 命名规范、文件组织、注释规范等人工约定
- **提供可运行的命令** — 始终给出 package.json 脚本中实际的 lint/format 命令
- **框架特定章节按需添加** — 只在有非显而易见约定时，才添加 React、Vue 等框架章节
- **删除空章节** — 无 TypeScript 特定约定则删除该章节
