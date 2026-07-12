---
paths:
  - "**/*.{ts,tsx}"
---

# TypeScript

补充 constitution 的 TS 红线：双重断言与 `@ts-ignore` 的禁令见 constitution，
此处不重复，只覆盖日常写 TS 时无法从代码推断的项目偏好。

## 空安全

禁用 `!` 非空断言；用可选链、类型收窄或显式判空。索引访问按 `T | undefined`
对待（noUncheckedIndexedAccess 心智），测试代码同样适用。

- 反例：`users[0]!.name`
- 正例：`users[0]?.name`，或 `const first = users[0]; if (first) first.name`

## 类型断言

单次 `as` 仅限边界处（`JSON.parse` 结果、外部数据入口），且断言目标写完整结构；
能用 `satisfies` 或泛型参数表达的不用断言。

- 反例：`const config = raw as Config`（内部数据流中断言）
- 正例：`JSON.parse(text) as Config`（边界）；`{ port: 3000 } satisfies Options`

## import 风格

类型导入用顶层 `import type`，不用内联 type 说明符。

- 反例：`import { type User, getUser } from './user'`
- 正例：`import type { User } from './user'` 与 `import { getUser } from './user'`

## 错误处理

`catch` 参数统一命名 `error`，类型按 `unknown` 对待；用 instanceof 收窄或
`String(error)` 转换后再用。

- 反例：`catch (e) { log(e.message) }`
- 正例：`catch (error) { log(error instanceof Error ? error.message : String(error)) }`

## 集合操作

优先不可变形式：`toSorted`/`toReversed`，不用原地变更的 `sort`/`reverse`。

- 反例：`items.sort(byName)`
- 正例：`const sorted = items.toSorted(byName)`

## 正则

正则统一带 `u` flag。

- 反例：`/\w+/g`
- 正例：`/\w+/gu`

## 与 lint 的关系

以上多数可由 oxlint 强制（catch-error-name、no-array-sort、
require-unicode-regexp 等）。目标项目配了 lint 时以 lint 为准；本 rule 覆盖
未配 lint 的项目，以及 lint 管不到的判断（断言边界、收窄方式）。
