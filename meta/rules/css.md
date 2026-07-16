---
name: css
status: ready
scope: "**/*.css"
tags: [frontend]
---

# 元指令：css rule

样式与设计 token 的工程纪律，作用于 `**/*.css`。

## 目标

固化 notes 仓 CSS 节点的设计系统主线与 shadcn 实践纪律；
只写代码推断不出的约定与踩过的坑。

## 约束（素材，构建时组织成产物）

设计 token 主线：

- CSS variables 定义 token → `@theme inline` 暴露给 Tailwind →
  组件用语义工具类；不在组件里写裸色值
- 红线：新增 token MUST 三处同改——`:root`、`.dark`、`@theme inline`，
  漏一处即明暗模式或工具类失效
- 颜色偏好 OKLCh：感知均匀、暗色模式表现一致

shadcn 纪律：

- 主题定制改 `globals.css` 的 token，不改组件源码
- 组件允许改 className，不改内部逻辑
- 跨项目复用走 preset code + `shadcn apply`

单位与渲染：

- rem 用于字号、em 用于间距的分工
- `-webkit-font-smoothing: antialiased` 只用于深色背景

坑（Things That Will Bite You）：

- `@layer` 体系里 unlayered 规则优先级高于任何 layer——
  覆盖性规则放进 layer 内等于自废武功

动画选型分工：

- 组件级交互动画用 Motion；复杂时间轴用 GSAP；
  页面过渡优先零依赖的原生 View Transitions

## 产物要求

- scoped 落点；token 三处同改与 unlayered 坑给正/反例
- 素材源：notes 仓 `20-areas/20-04-tech-tree/css/CSS-视觉系统.md`、
  `CSS-shadcn.md`、`CSS-NextJS全局样式.md`、
  `30-resources/30-03-开发工具/Obsidian-quietpaper主题.md`（撞墙记录）
