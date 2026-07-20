---
paths:
  - "**/*.{ts,tsx}"
---

# TypeScript

TS 的类型红线与日常纪律，只覆盖写 TS 时无法从代码推断的项目偏好。
本文多数条目可由 oxlint 强制（catch-error-name、no-array-sort、
require-unicode-regexp 等）：目标项目配了 lint 时以 lint 配置为准，
本 rule 覆盖未配 lint 的项目与 lint 管不到的判断（断言边界、收窄方式）。

## 红线

- MUST NOT 双重断言——`as X as Y` 经 `unknown`/`any` 中转绕过全部类型检查
  - 反：`value as unknown as Config`；正：修类型建模，或在边界单次 `as`（见「类型断言」）
- MUST NOT 用 `@ts-ignore`/`@ts-expect-error` 或 lint 抑制注释
  （`eslint-disable`/`oxlint-disable`）——被压掉的错误不会消失，只会失去追踪
  - 反：`// @ts-expect-error` 压掉报错；正：修掉报错本身

## 空安全

- MUST NOT 用 `!` 非空断言——它只把崩溃点后移到运行时；用可选链、类型收窄或显式判空
  - 正：`const first = users[0]; if (first) use(first.name)`；反：`use(users[0]!.name)`
- 索引访问按 `T | undefined` 对待（noUncheckedIndexedAccess 心智），测试代码同样适用
  - 正：`expect(rows[0]?.id).toBe("a")`；反：`expect(rows[0].id).toBe("a")`

## 类型断言

- 单次 `as` 仅限边界处（`JSON.parse` 结果、外部数据入口），且断言目标写完整结构——
  内部数据流中需要断言说明类型建模有误，修类型而非加断言
  - 正：`JSON.parse(text) as Config`（边界，Config 为完整结构）；反：`const config = raw as Config`（内部数据流）
- 能用 `satisfies` 或泛型参数表达的不用断言——断言会掩盖多余/缺失属性，`satisfies` 校验之余保留推断
  - 正：`const options = { port: 3000 } satisfies Options`；反：`const options = { port: 3000 } as Options`

## import

- 类型导入用顶层 `import type`，不用内联 type 说明符
  - 正：`import type { User } from "./user"` 与 `import { getUser } from "./user"`；反：`import { type User, getUser } from "./user"`
- 路径导入 SHOULD 用 `@/*` 别名而非相对父级路径（`../`）；少数项目禁用别名，从其配置
  - 正：`import { fmt } from "@/utils/fmt"`；反：`import { fmt } from "../../utils/fmt"`

## 错误处理

- `catch` 参数统一命名 `error`，类型按 `unknown` 对待；instanceof 收窄或 `String(error)` 转换后再用
  - 正：`catch (error) { log(error instanceof Error ? error.message : String(error)) }`；反：`catch (e) { log(e.message) }`

## 不可变与内建

- 集合操作优先不可变形式——`sort`/`reverse` 原地修改，易引入隐蔽副作用
  - 正：`const sorted = items.toSorted(byName)`；反：`items.sort(byName)`
- 正则统一带 `u` flag——正确处理 surrogate pair，非法转义在编译期报错
  - 正：`/\w+/gu`；反：`/\w+/g`

## 枚举与类

- MUST NOT 用 `enum`；用 `as const` 对象 + 派生联合类型——字面量联合零运行时开销、
  无 IIFE 编译产物、类型更安全
  - 正：`const Status = { Open: "open", Done: "done" } as const; type Status = typeof Status[keyof typeof Status]`；反：`enum Status { Open, Done }`
- 类的私有字段用 `#` 语法，不用 `_` 前缀约定——`#` 是语言级私有，运行时真正不可访问
  - 正：`#cache = new Map()`；反：`private _cache = new Map()`
