---
name: typescript
description: TypeScript 类型纪律：禁双重断言/@ts-ignore/非空断言，import type 风格
status: ready
scope: "**/*.{ts,tsx}"
tags: [ts]
---

# 元指令：typescript rule

TypeScript 项目的类型纪律，作用于 `**/*.{ts,tsx}`。

## 目标

TS 的类型红线与日常纪律，覆盖写 TS 时 Claude 无法从代码推断的项目偏好。
红线原在 constitution，2026-07-16 迁入本 rule——红线跟语言走，
Python 项目不再背 TS 禁令。

## 约束（素材，构建时组织成产物）

- 红线（MUST NOT）：双重断言（`value as X as Y`）；`@ts-ignore`/
  `@ts-expect-error` 及 lint 抑制注释（`eslint-disable`/`oxlint-disable`）
- 空安全：禁用 `!` 非空断言；用可选链、类型收窄或显式判空。
  索引访问在 strict 模式下按 `T | undefined` 对待（noUncheckedIndexedAccess 心智），
  测试代码同样适用
- 类型断言：单次 `as` 仅限边界处（`JSON.parse` 结果、外部数据入口），
  且断言目标写完整结构；能用 `satisfies` 或泛型参数表达的不用断言
- import 风格：类型导入用顶层 `import type`，不用内联 type 说明符
- 错误处理：`catch` 参数统一命名 `error`，类型按 `unknown` 对待、
  用 `String(error)` 或 instanceof 收窄后再用
- 集合操作优先不可变形式（`toSorted`/`toReversed` 而非 `sort`/`reverse`）
- 正则统一带 `u` flag
- 禁用 `enum`：用 `as const` 对象 + 派生联合类型
  （`type X = typeof Obj[keyof typeof Obj]`）——字面量联合零运行时开销、
  无 IIFE 编译产物、类型更安全
- 类的私有字段用 `#` 语法，不用 `_` 前缀约定
- 路径导入 SHOULD 用 `@/*` 别名而非相对父级路径（`../`）；视项目而定，
  少数项目禁用别名时从其配置
- lint 说明：以上多数可由 oxlint 强制（catch-error-name、no-array-sort、
  require-unicode-regexp 等）；目标项目配了 lint 时以 lint 为准，
  本 rule 覆盖未配 lint 的项目与 lint 管不到的判断（断言边界、收窄方式）

## 产物要求

- scoped 落点，正文允许比 global 细，但仍按「Claude 无法从代码推断才写」取舍
- 每条约束给一个正/反例（一行级，不展开长代码块）
