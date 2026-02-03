---
title: 像 API Routes 一样验证 Server Actions
impact: CRITICAL
impactDescription: prevents unauthorized access to server mutations
tags: server, server-actions, authentication, security, authorization
---

## 像 API Routes 一样验证 Server Actions

**Impact: CRITICAL (防止对服务器突变的未授权访问)**

Server Actions (带有 `"use server"` 的函数) 作为公共端点公开，就像 API Routes 一样。务必在每个 Server Action **内部** 验证身份和授权——不要仅仅依赖中间件、布局保护或页面级检查，因为 Server Actions 可以直接被调用。

Next.js 文档明确指出：“将 Server Actions 视为面向公众的 API 端点，并采取相同的安全预防措施，验证用户是否被允许执行突变。”

**Incorrect (无身份验证检查):**

```typescript
'use server'

export async function deleteUser(userId: string) {
  // 任何人都可以调用这个！无 auth 检查
  await db.user.delete({ where: { id: userId } })
  return { success: true }
}
```

**Correct (在 action 内部进行身份验证):**

```typescript
'use server'

import { verifySession } from '@/lib/auth'
import { unauthorized } from '@/lib/errors'

export async function deleteUser(userId: string) {
  // 始终在 action 内部检查 auth
  const session = await verifySession()
  
  if (!session) {
    throw unauthorized('Must be logged in')
  }
  
  // 同时检查授权
  if (session.user.role !== 'admin' && session.user.id !== userId) {
    throw unauthorized('Cannot delete other users')
  }
  
  await db.user.delete({ where: { id: userId } })
  return { success: true }
}
```

**带输入验证:**

```typescript
'use server'

import { verifySession } from '@/lib/auth'
import { z } from 'zod'

const updateProfileSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email()
})

export async function updateProfile(data: unknown) {
  // 首先验证输入
  const validated = updateProfileSchema.parse(data)
  
  // 然后验证身份
  const session = await verifySession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  
  // 然后授权
  if (session.user.id !== validated.userId) {
    throw new Error('Can only update own profile')
  }
  
  // 最后执行 mutation
  await db.user.update({
    where: { id: validated.userId },
    data: {
      name: validated.name,
      email: validated.email
    }
  })
  
  return { success: true }
}
```

Reference: [https://nextjs.org/docs/app/guides/authentication](https://nextjs.org/docs/app/guides/authentication)
