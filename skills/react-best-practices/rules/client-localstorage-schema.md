---
title: 版本化和最小化 localStorage 数据
impact: MEDIUM
impactDescription: prevents schema conflicts, reduces storage size
tags: client, localStorage, storage, versioning, data-minimization
---

## 版本化和最小化 localStorage 数据

为键添加版本前缀并仅存储所需字段。防止 schema 冲突和意外存储敏感数据。

**Incorrect:**

```typescript
// 无版本，存储所有内容，无错误处理
localStorage.setItem('userConfig', JSON.stringify(fullUserObject))
const data = localStorage.getItem('userConfig')
```

**Correct:**

```typescript
const VERSION = 'v2'

function saveConfig(config: { theme: string; language: string }) {
  try {
    localStorage.setItem(`userConfig:${VERSION}`, JSON.stringify(config))
  } catch {
    // 在隐身/私密浏览、配额超出或禁用时抛出
  }
}

function loadConfig() {
  try {
    const data = localStorage.getItem(`userConfig:${VERSION}`)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

// 从 v1 迁移到 v2
function migrate() {
  try {
    const v1 = localStorage.getItem('userConfig:v1')
    if (v1) {
      const old = JSON.parse(v1)
      saveConfig({ theme: old.darkMode ? 'dark' : 'light', language: old.lang })
      localStorage.removeItem('userConfig:v1')
    }
  } catch {}
}
```

**存储来自服务器响应的最小字段:**

```typescript
// 用户对象有 20+ 个字段，只存储 UI 需要的
function cachePrefs(user: FullUser) {
  try {
    localStorage.setItem('prefs:v1', JSON.stringify({
      theme: user.preferences.theme,
      notifications: user.preferences.notifications
    }))
  } catch {}
}
```

**始终包裹在 try-catch 中:** `getItem()` 和 `setItem()` 在隐身/私密浏览 (Safari, Firefox)、配额超出或禁用时会抛出异常。

**优势:** 通过版本控制进行 Schema 演进，减少存储大小，防止存储令牌/PII/内部标志。
