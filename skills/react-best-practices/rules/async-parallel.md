---
title: 对独立操作使用 Promise.all()
impact: CRITICAL
impactDescription: 2-10× improvement
tags: async, parallelization, promises, waterfalls
---

## 对独立操作使用 Promise.all()

当异步操作没有相互依赖关系时，使用 `Promise.all()` 并发执行它们。

**Incorrect (顺序执行，3 次往返):**

```typescript
const user = await fetchUser()
const posts = await fetchPosts()
const comments = await fetchComments()
```

**Correct (并行执行，1 次往返):**

```typescript
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
])
```
