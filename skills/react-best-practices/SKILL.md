---
name: vercel-react-best-practices
description: Vercel Engineering 出品的 React 和 Next.js 性能优化指南。在编写、审查或重构 React/Next.js 代码时使用此技能，以确保最佳性能模式。适用于涉及 React 组件、Next.js 页面、数据获取、Bundle 优化或性能改进的任务。
license: MIT
metadata:
  author: vercel
  version: "1.0.0"
---

# Vercel React Best Practices

Vercel 维护的 React 和 Next.js 应用程序综合性能优化指南。包含 8 个类别的 57 条规则，按影响优先级排列，用于指导自动重构和代码生成。

## 适用场景

在以下情况下参考这些指南：
- 编写新的 React 组件或 Next.js 页面
- 实现数据获取（客户端或服务端）
- 审查代码性能问题
- 重构现有 React/Next.js 代码
- 优化 Bundle Size 或加载时间

## 规则分类（按优先级）

| 优先级 | 类别 | 影响 | 前缀 |
|----------|----------|--------|--------|
| 1 | Eliminating Waterfalls (消除瀑布流) | CRITICAL | `async-` |
| 2 | Bundle Size Optimization (Bundle 体积优化) | CRITICAL | `bundle-` |
| 3 | Server-Side Performance (服务端性能) | HIGH | `server-` |
| 4 | Client-Side Data Fetching (客户端数据获取) | MEDIUM-HIGH | `client-` |
| 5 | Re-render Optimization (重渲染优化) | MEDIUM | `rerender-` |
| 6 | Rendering Performance (渲染性能) | MEDIUM | `rendering-` |
| 7 | JavaScript Performance (JavaScript 性能) | LOW-MEDIUM | `js-` |
| 8 | Advanced Patterns (高级模式) | LOW | `advanced-` |

## 快速参考

### 1. Eliminating Waterfalls (CRITICAL)

- `async-defer-await` - 将 await 移至实际使用的分支中
- `async-parallel` - 使用 Promise.all() 进行独立操作
- `async-dependencies` - 对部分依赖项使用 better-all
- `async-api-routes` - 在 API Routes 中尽早启动 promise，延迟 await
- `async-suspense-boundaries` - 使用 Suspense 流式传输内容

### 2. Bundle Size Optimization (CRITICAL)

- `bundle-barrel-imports` - 直接导入，避免 barrel 文件
- `bundle-dynamic-imports` - 对重型组件使用 next/dynamic
- `bundle-defer-third-party` - 在 hydration 后加载分析/日志记录
- `bundle-conditional` - 仅在功能激活时加载模块
- `bundle-preload` - 在 hover/focus 时预加载以提高感知速度

### 3. Server-Side Performance (HIGH)

- `server-auth-actions` - 像 API Routes 一样验证 Server Actions
- `server-cache-react` - 使用 React.cache() 进行按请求去重
- `server-cache-lru` - 使用 LRU 缓存进行跨请求缓存
- `server-dedup-props` - 避免在 RSC props 中重复序列化
- `server-serialization` - 最小化传递给客户端组件的数据
- `server-parallel-fetching` - 重构组件以并行化 fetch
- `server-after-nonblocking` - 对非阻塞操作使用 after()

### 4. Client-Side Data Fetching (MEDIUM-HIGH)

- `client-swr-dedup` - 使用 SWR 进行自动请求去重
- `client-event-listeners` - 对全局事件监听器去重
- `client-passive-event-listeners` - 对滚动使用 passive 监听器
- `client-localstorage-schema` - 对 localStorage 数据进行版本控制和最小化

### 5. Re-render Optimization (MEDIUM)

- `rerender-defer-reads` - 不要订阅仅在回调中使用的 state
- `rerender-memo` - 将昂贵的工作提取到 memoized 组件中
- `rerender-memo-with-default-value` - 提升默认非原始 props
- `rerender-dependencies` - 在 effects 中使用原始依赖项
- `rerender-derived-state` - 订阅派生的布尔值，而不是原始值
- `rerender-derived-state-no-effect` - 在渲染期间派生 state，而不是在 effects 中
- `rerender-functional-setstate` - 使用函数式 setState 以获得稳定的回调
- `rerender-lazy-state-init` - 将函数传递给 useState 以处理昂贵的值
- `rerender-simple-expression-in-memo` - 避免对简单的原始值使用 memo
- `rerender-move-effect-to-event` - 将交互逻辑放在事件处理程序中
- `rerender-transitions` - 对非紧急更新使用 startTransition
- `rerender-use-ref-transient-values` - 对瞬态频繁值使用 refs

### 6. Rendering Performance (MEDIUM)

- `rendering-animate-svg-wrapper` - 动画化 div 包装器，而不是 SVG 元素
- `rendering-content-visibility` - 对长列表使用 content-visibility
- `rendering-hoist-jsx` - 将静态 JSX 提取到组件外部
- `rendering-svg-precision` - 降低 SVG 坐标精度
- `rendering-hydration-no-flicker` - 对仅客户端数据使用内联脚本
- `rendering-hydration-suppress-warning` - 抑制预期的不匹配
- `rendering-activity` - 使用 Activity 组件进行显示/隐藏
- `rendering-conditional-render` - 使用三元运算符，而不是 && 进行条件渲染
- `rendering-usetransition-loading` - 优先使用 useTransition 处理加载状态

### 7. JavaScript Performance (LOW-MEDIUM)

- `js-batch-dom-css` - 通过类或 cssText 批处理 CSS 更改
- `js-index-maps` - 为重复查找构建 Map
- `js-cache-property-access` - 在循环中缓存对象属性
- `js-cache-function-results` - 在模块级 Map 中缓存函数结果
- `js-cache-storage` - 缓存 localStorage/sessionStorage 读取
- `js-combine-iterations` - 将多个 filter/map 组合成一个循环
- `js-length-check-first` - 在昂贵比较之前检查数组长度
- `js-early-exit` - 从函数提前返回
- `js-hoist-regexp` - 将 RegExp 创建提升到循环外部
- `js-min-max-loop` - 使用循环代替 sort 查找 min/max
- `js-set-map-lookups` - 使用 Set/Map 进行 O(1) 查找
- `js-tosorted-immutable` - 使用 toSorted() 实现不可变性

### 8. Advanced Patterns (LOW)

- `advanced-event-handler-refs` - 将事件处理程序存储在 refs 中
- `advanced-init-once` - 每个应用程序加载仅初始化一次
- `advanced-use-latest` - 使用 useLatest 获得稳定的回调 refs

## 如何使用

阅读单个规则文件以获取详细解释和代码示例：

```
rules/async-parallel.md
rules/bundle-barrel-imports.md
```

每个规则文件包含：
- 简要解释为什么它很重要
- 带有解释的错误代码示例
- 带有解释的正确代码示例
- 额外的上下文和参考资料

## 完整编译文档

有关扩展所有规则的完整指南：`AGENTS.md`
