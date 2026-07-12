---
name: typescript
status: ready
scope: "**/*.{ts,tsx}"
---

# 元指令：typescript rule

TypeScript 项目的类型纪律，作用于 `**/*.{ts,tsx}`。

## 目标

补充 constitution 的 TS 红线（双重断言、`@ts-ignore` 已在 constitution，
本 rule 不重复），覆盖日常写 TS 时 Claude 无法从代码推断的项目偏好。

## 约束（素材，构建时组织成产物）

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
- lint 说明：以上多数可由 oxlint 强制（catch-error-name、no-array-sort、
  require-unicode-regexp 等）；目标项目配了 lint 时以 lint 为准，
  本 rule 覆盖未配 lint 的项目与 lint 管不到的判断（断言边界、收窄方式）

## 产物要求

- scoped 落点，正文允许比 global 细，但仍按「Claude 无法从代码推断才写」取舍
- 每条约束给一个正/反例（一行级，不展开长代码块）
