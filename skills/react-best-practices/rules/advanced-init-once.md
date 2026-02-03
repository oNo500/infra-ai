---
title: 仅初始化 App 一次，而不是每次 Mount
impact: LOW-MEDIUM
impactDescription: avoids duplicate init in development
tags: initialization, useEffect, app-startup, side-effects
---

## 仅初始化 App 一次，而不是每次 Mount

不要将必须在每次 App 加载时运行一次的 App 范围初始化放在组件的 `useEffect([])` 中。组件可以重新挂载，effects 将重新运行。请改用模块级 guard 或入口模块中的顶级初始化。

**Incorrect (在开发中运行两次，在重新挂载时重新运行):**

```tsx
function Comp() {
  useEffect(() => {
    loadFromStorage()
    checkAuthToken()
  }, [])

  // ...
}
```

**Correct (每次 App 加载运行一次):**

```tsx
let didInit = false

function Comp() {
  useEffect(() => {
    if (didInit) return
    didInit = true
    loadFromStorage()
    checkAuthToken()
  }, [])

  // ...
}
```

Reference: [Initializing the application](https://react.dev/learn/you-might-not-need-an-effect#initializing-the-application)
