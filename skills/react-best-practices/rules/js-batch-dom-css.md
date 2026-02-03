---
title: 避免 Layout Thrashing
impact: MEDIUM
impactDescription: prevents forced synchronous layouts and reduces performance bottlenecks
tags: javascript, dom, css, performance, reflow, layout-thrashing
---

## 避免 Layout Thrashing

避免将样式写入与布局读取交错。当你在样式更改之间读取布局属性（如 `offsetWidth`, `getBoundingClientRect()`, 或 `getComputedStyle()`）时，浏览器会被强制触发同步回流（reflow）。

**This is OK (浏览器批量处理样式更改):**
```typescript
function updateElementStyles(element: HTMLElement) {
  // 每一行都会使样式无效，但浏览器会批量重新计算
  element.style.width = '100px'
  element.style.height = '200px'
  element.style.backgroundColor = 'blue'
  element.style.border = '1px solid black'
}
```

**Incorrect (交错的读写强制回流):**
```typescript
function layoutThrashing(element: HTMLElement) {
  element.style.width = '100px'
  const width = element.offsetWidth  // 强制回流
  element.style.height = '200px'
  const height = element.offsetHeight  // 强制另一次回流
}
```

**Correct (批量写入，然后读取一次):**
```typescript
function updateElementStyles(element: HTMLElement) {
  // 批量所有写入在一起
  element.style.width = '100px'
  element.style.height = '200px'
  element.style.backgroundColor = 'blue'
  element.style.border = '1px solid black'
  
  // 所有写入完成后读取（单次回流）
  const { width, height } = element.getBoundingClientRect()
}
```

**Correct (批量读取，然后写入):**
```typescript
function avoidThrashing(element: HTMLElement) {
  // 读取阶段 - 首先进行所有布局查询
  const rect1 = element.getBoundingClientRect()
  const offsetWidth = element.offsetWidth
  const offsetHeight = element.offsetHeight
  
  // 写入阶段 - 所有样式更改在后
  element.style.width = '100px'
  element.style.height = '200px'
}
```

**Better: 使用 CSS 类**
```css
.highlighted-box {
  width: 100px;
  height: 200px;
  background-color: blue;
  border: 1px solid black;
}
```
```typescript
function updateElementStyles(element: HTMLElement) {
  element.classList.add('highlighted-box')
  
  const { width, height } = element.getBoundingClientRect()
}
```

**React example:**
```tsx
// Incorrect: 将样式更改与布局查询交错
function Box({ isHighlighted }: { isHighlighted: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (ref.current && isHighlighted) {
      ref.current.style.width = '100px'
      const width = ref.current.offsetWidth // 强制布局
      ref.current.style.height = '200px'
    }
  }, [isHighlighted])
  
  return <div ref={ref}>Content</div>
}

// Correct: 切换 class
function Box({ isHighlighted }: { isHighlighted: boolean }) {
  return (
    <div className={isHighlighted ? 'highlighted-box' : ''}>
      Content
    </div>
  )
}
```

尽可能使用 CSS 类而不是内联样式。CSS 文件由浏览器缓存，类提供了更好的关注点分离，并且更易于维护。

有关强制布局操作的更多信息，请参阅 [this gist](https://gist.github.com/paulirish/5d52fb081b3570c81e3a) 和 [CSS Triggers](https://csstriggers.com/)。
