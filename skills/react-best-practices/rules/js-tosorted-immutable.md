---
title: 使用 toSorted() 代替 sort() 实现不可变性
impact: MEDIUM-HIGH
impactDescription: prevents mutation bugs in React state
tags: javascript, arrays, immutability, react, state, mutation
---

## 使用 toSorted() 代替 sort() 实现不可变性

`.sort()` 会就地改变数组，这可能会导致 React state 和 props 出现 bug。使用 `.toSorted()` 创建一个新的排序数组而不进行变异。

**Incorrect (改变原始数组):**

```typescript
function UserList({ users }: { users: User[] }) {
  // 改变 users prop 数组！
  const sorted = useMemo(
    () => users.sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  )
  return <div>{sorted.map(renderUser)}</div>
}
```

**Correct (创建新数组):**

```typescript
function UserList({ users }: { users: User[] }) {
  // 创建新的排序数组，原始数组未改变
  const sorted = useMemo(
    () => users.toSorted((a, b) => a.name.localeCompare(b.name)),
    [users]
  )
  return <div>{sorted.map(renderUser)}</div>
}
```

**为什么这在 React 中很重要:**

1. Props/state 变异破坏了 React 的不可变性模型 - React 期望 props 和 state 被视为只读
2. 导致 stale closure bug - 在闭包（回调，effects）内改变数组可能会导致意外行为

**浏览器支持 (旧浏览器的回退):**

`.toSorted()` 在所有现代浏览器中均可用 (Chrome 110+, Safari 16+, Firefox 115+, Node.js 20+)。对于旧环境，使用展开运算符：

```typescript
// Fallback for older browsers
const sorted = [...items].sort((a, b) => a.value - b.value)
```

**其他不可变数组方法:**

- `.toSorted()` - immutable sort
- `.toReversed()` - immutable reverse
- `.toSpliced()` - immutable splice
- `.with()` - immutable element replacement
