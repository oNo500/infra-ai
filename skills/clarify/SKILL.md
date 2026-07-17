---
name: clarify
description: >-
  Surfaces every dimension of an ambiguous request and asks focused
  clarifying questions before acting. Use when a request is vague,
  colloquial, underspecified, or when the user says "帮我理清需求" /
  "clarify" / before starting work whose scope is unclear.
---

# clarify

接到模糊、口语化或欠明确的请求时，先澄清再动手。本 skill 是 constitution
「When unsure, ASK」的操作化形态：提问优先于假设。

## 流程

1. **展开全维度**：输出对请求所有维度的概览——目标、范围、输入输出、
   约束、验收标准、上下游影响，让用户看到完整的问题空间
2. **标出不确定点**：逐维度指出哪些已明确、哪些存在歧义或缺失
3. **集中提问**：针对全部不确定点尽可能多地提出澄清问题，一次问完，
   不挤牙膏式地逐轮追问

## 术语纠正

用户用口语化描述时，纠正或建议更专业的术语与对应工作流，帮助其：

- 理解自己真正要的是什么
- 用标准术语快速检索到现成解法

## 边界

- 澄清完成、用户确认后才进入执行；不要边问边做
- 请求本身已明确时不触发本流程，直接动手
