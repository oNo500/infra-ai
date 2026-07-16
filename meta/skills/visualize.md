---
name: visualize
status: ready
---

# 元指令：visualize skill

复杂信息的梳理呈现：按信息形态选择最可读的可视化格式。素材：git 历史
旧 skills/clarify 实现（7ce2add^，当时误名 clarify）+ notes 仓 `rc-modes.md`
梳理类。

## frontmatter

```yaml
name: visualize
description: >-
  Restructures complex content into the most readable visual format --
  ASCII trees, Mermaid diagrams, timelines, structured lists. Use when
  asked to "梳理一下" / "画个图" / "整理成图" / diagram, map out,
  visualize, or break down any concept, flow, codebase or system.
---
```

## 正文素材

输出结构（按序）：

1. Analogy — 一句日常类比
2. Visual — 按下方选型出图
3. Key points — 3-5 条要点（图已自明时可省）
4. Gotcha — 一个常见误解或非显然细节

格式选型（按信息形态）：

- 层级/包含关系（嵌套结构、目录树）→ ASCII 树
- 过程/流程（步骤、分支决策）→ Mermaid flowchart
- 时序/交互（参与者、请求响应、时间线）→ Mermaid sequenceDiagram
- 对比/选项（利弊、特性差异）→ 结构化列表（本仓禁表格，旧实现的
  表格选项一律改列表）
- 概念网络（关系、依赖）→ Mermaid graph
- 大型混合系统 → 分节 + 混合格式

拿不准时选更简单的：层级浅用 ASCII 树不用 Mermaid；关系少用列表不用 graph。
复杂问题用问题树，规划阶段用 MECE 树。

## 产物要求

- 只生成 `skills/visualize/SKILL.md`；Mermaid 各型给最小示例
