---
name: explaining-code
status: ready
---

# 元指令：explaining-code skill

讲解代码的输出结构约定。素材：git 历史旧实现（7ce2add^）+ notes 仓
`rc-modes.md` 解释类，两者内容一致，直接复建。

## frontmatter（英文，保持触发匹配）

```yaml
name: explaining-code
description: >-
  Explains code with analogies, ASCII diagrams and step-by-step
  walkthroughs. Use when explaining how code works, teaching about
  a codebase, or when the user asks "how does this work" / "解释这段代码" / "教我".
---
```

## 正文素材

讲解代码 MUST 包含四要素，按序：

1. Analogy — 用日常生活事物类比这段代码
2. Diagram — ASCII 图表达流程、结构或关系
3. Walkthrough — 逐步走查发生了什么
4. Gotcha — 一个常见误解或易错点

语气保持 conversational（SHOULD）；复杂概念 MAY 用多个类比。

## 产物要求

- 只生成 `skills/explaining-code/SKILL.md`，短小（20 行内正文）
