# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. 消除瀑布流 (async)

**Impact:** CRITICAL  
**Description:** 瀑布流是头号性能杀手。每一个串行的 await 都会增加完整的网络延迟。消除它们能带来最大的收益。

## 2. 包体积优化 (bundle)

**Impact:** CRITICAL  
**Description:** 减少初始包体积可以改善交互时间 (TTI) 和最大内容绘制 (LCP)。

## 3. 服务端性能 (server)

**Impact:** HIGH  
**Description:** 优化服务端渲染和数据获取，消除服务端瀑布流并缩短响应时间。

## 4. 客户端数据获取 (client)

**Impact:** MEDIUM-HIGH  
**Description:** 自动去重和高效的数据获取模式可以减少冗余的网络请求。

## 5. 重渲染优化 (rerender)

**Impact:** MEDIUM  
**Description:** 减少不必要的重渲染可以尽可能减少无用的计算并提高 UI 响应速度。

## 6. 渲染性能 (rendering)

**Impact:** MEDIUM  
**Description:** 优化渲染过程，减少浏览器的渲染工作量。

## 7. JavaScript 性能 (js)

**Impact:** LOW-MEDIUM  
**Description:** 针对热点路径的微优化积累起来也能带来显著的提升。

## 8. 高级模式 (advanced)

**Impact:** LOW  
**Description:** 针对特定场景的高级模式，需要谨慎实现。
