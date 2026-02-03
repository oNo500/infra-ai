---
title: 使用 useTransition 代替手动 Loading 状态
impact: LOW
impactDescription: reduces re-renders and improves code clarity
tags: rendering, transitions, useTransition, loading, state
---

## 使用 useTransition 代替手动 Loading 状态

使用 `useTransition` 而不是手动的 `useState` 来处理 loading 状态。这提供了内置的 `isPending` 状态并自动管理 transitions。

**Incorrect (手动 loading 状态):**

```tsx
function SearchResults() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const handleSearch = async (value: string) => {
    setIsLoading(true)
    setQuery(value)
    const data = await fetchResults(value)
    setResults(data)
    setIsLoading(false)
  }

  return (
    <>
      <input onChange={(e) => handleSearch(e.target.value)} />
      {isLoading && <Spinner />}
      <ResultsList results={results} />
    </>
  )
}
```

**Correct (使用内置 pending 状态的 useTransition):**

```tsx
import { useTransition, useState } from 'react'

function SearchResults() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isPending, startTransition] = useTransition()

  const handleSearch = (value: string) => {
    setQuery(value) // 立即更新输入
    
    startTransition(async () => {
      // Fetch and update results
      const data = await fetchResults(value)
      setResults(data)
    })
  }

  return (
    <>
      <input onChange={(e) => handleSearch(e.target.value)} />
      {isPending && <Spinner />}
      <ResultsList results={results} />
    </>
  )
}
```

**Benefits:**

- **自动 pending 状态**: 无需手动管理 `setIsLoading(true/false)`
- **错误恢复**: 即使 transition 抛出错误，Pending 状态也能正确重置
- **更好的响应性**: 在更新期间保持 UI 响应
- **中断处理**: 新的 transition 会自动取消待处理的 transition

Reference: [useTransition](https://react.dev/reference/react/useTransition)
