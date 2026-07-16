---
name: clarify
status: ready
---

# 元指令：clarify skill

澄清提问：接到模糊/口语化请求时，先展开全维度再集中提问。素材：notes 仓
`rc-modes.md` 澄清类（原文 prompt + 备用措辞）。注意：git 历史里旧的
skills/clarify 是「梳理可视化」，那部分归 visualize skill，与本 skill 无关。

## frontmatter

```yaml
name: clarify
description: >-
  Surfaces every dimension of an ambiguous request and asks focused
  clarifying questions before acting. Use when a request is vague,
  colloquial, underspecified, or when the user says "帮我理清需求" /
  "clarify" / before starting work whose scope is unclear.
---
```

## 正文素材

- 核心流程：输出请求所有维度的概览 → 找出不确定点 → 尽可能多地提出
  澄清问题（一次集中问，不挤牙膏）
- 术语纠正：用户用口语化描述时，纠正或建议更专业的术语与工作流，
  帮助其理解并快速找到解法
- 提问优先于假设——与 constitution 的 When unsure, ASK 同姿态，
  本 skill 是它的操作化形态

## 产物要求

- 只生成 `skills/clarify/SKILL.md`，短小
