---
paths:
  - "**/*.css"
---

# CSS

样式与设计 token 的工程纪律：token 主线、shadcn 定制边界、单位分工、
`@layer` 优先级坑与动画选型。

## 设计 token 主线

token 流向：CSS variables 定义 → `@theme inline` 暴露给 Tailwind →
组件只用语义工具类。

- 新增 token MUST 三处同改：`:root`、`.dark`、`@theme inline`——漏 `.dark`
  暗色模式沿用亮色值，漏 `@theme inline` 对应工具类不生成

```css
/* 正：三处同改 */
:root { --chart-6: oklch(0.65 0.15 250); }
.dark { --chart-6: oklch(0.72 0.12 250); }
@theme inline { --color-chart-6: var(--chart-6); }

/* 反：只改 :root——暗色模式失效，bg-chart-6 等工具类不存在 */
:root { --chart-6: oklch(0.65 0.15 250); }
```

- 颜色值 SHOULD 用 OKLCh：感知均匀，明暗两套 token 的对比关系一致

## shadcn 纪律

- 主题定制只改 `globals.css` 的 token，不改组件源码
- 组件允许改 className，不改内部逻辑
- 跨项目复用主题走 preset code + `shadcn apply`

## 单位与渲染

- 字号用 rem（随根字号缩放，尊重用户浏览器设置）；间距用 em
  （随所在元素字号联动，字号调整时间距等比跟随）
- `-webkit-font-smoothing: antialiased` 只用于深色背景——浅色底深色字
  会被渲染得偏细发虚

## @layer 优先级

- unlayered 规则优先级高于任何 layer 内规则，与 specificity 无关——
  覆盖性规则 MUST NOT 放进 layer，否则被任意 unlayered 规则压过

```css
/* 反：override 进了 layer，等于自废武功 */
@layer overrides {
  .prose a { text-decoration: none; }
}

/* 正：覆盖性规则保持 unlayered */
.prose a { text-decoration: none; }
```

## 动画选型

- 组件级交互动画用 Motion；复杂时间轴编排用 GSAP；页面过渡优先
  零依赖的原生 View Transitions
