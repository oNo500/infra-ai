---
title: 优化 SVG 精度
impact: LOW
impactDescription: reduces file size
tags: rendering, svg, optimization, svgo
---

## 优化 SVG 精度

降低 SVG 坐标精度以减小文件大小。最佳精度取决于 viewBox 大小，但一般来说，应该考虑降低精度。

**Incorrect (精度过高):**

```svg
<path d="M 10.293847 20.847362 L 30.938472 40.192837" />
```

**Correct (1 位小数):**

```svg
<path d="M 10.3 20.8 L 30.9 40.2" />
```

**Automate with SVGO:**

```bash
npx svgo --precision=1 --multipass icon.svg
```
