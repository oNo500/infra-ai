---
title: 防止 API Routes 中的瀑布流链
impact: CRITICAL
impactDescription: 2-10× improvement
tags: api-routes, server-actions, waterfalls, parallelization
---

## 防止 API Routes 中的瀑布流链

在 API Routes 和 Server Actions 中，即使尚未 `await` 它们，也应立即启动独立操作。

**Incorrect (config 等待 auth，data 等待两者):**

```typescript
export async function GET(request: Request) {
  const session = await auth()
  const config = await fetchConfig()
  const data = await fetchData(session.user.id)
  return Response.json({ data, config })
}
```

**Correct (auth 和 config 立即启动):**

```typescript
export async function GET(request: Request) {
  const sessionPromise = auth()
  const configPromise = fetchConfig()
  const session = await sessionPromise
  const [config, data] = await Promise.all([
    configPromise,
    fetchData(session.user.id)
  ])
  return Response.json({ data, config })
}
```

对于具有更复杂依赖链的操作，使用 `better-all` 自动最大化并行性（参见基于依赖的并行化）。
