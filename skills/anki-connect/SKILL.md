---
name: anki-connect
description: >-
  Turns study material into Anki cards following the user's card
  templates and adds them via the AnkiConnect API (localhost:8765).
  Use when asked to make flashcards, add notes to Anki, or convert
  notes/interview prep into spaced-repetition cards.
---

# anki-connect

把学习材料做成 Anki 卡片，按下方六种模版组织正反面，经 AnkiConnect API
写入。前提：Anki 桌面端运行中且已装 AnkiConnect 插件（监听
`localhost:8765`）。

## 红线

- 写入前 MUST 列出将建卡片全文给用户确认，不静默批量写
- `addNote` 遇重复会直接报错，写入前 MUST 先 `findNotes` 查重

## 选题：先过滤再制卡

- 入卡：原理解释、对比辨析、易混淆概念、高频考点
- 不入卡：速查列表、代码片段参考、工具操作步骤——这些查笔记比背 Anki 合适
- 算法只建「题目特征 → 解法」的模式索引卡，不替代刷题

## 六种卡片模版

按材料的认知操作类型选模版；背面里的 `---` 是卡片内部的分段线。

### 1 概念解释

适用原理类、定义类。正面：`某概念 是什么？` / `某概念 的原理？`

```
核心一句话
---
关键细节（2-4 条）
---
与相似概念的一句话区别（可选）
```

### 2 对比辨析

适用两个或多个技术的选型对比。正面：`A vs B，核心区别？` /
`什么时候用 A，什么时候用 B？`

```
A：描述
B：描述
---
决策规则（一句话）
```

### 3 场景诊断

适用反模式、性能问题、最佳实践。正面：描述症状/场景，问原因与解法。

```
根因（一句话）
---
❌ 错误写法
✅ 正确写法
---
触发条件
```

（❌/✅ 是用户既有卡片格式里的标记，保留原样。）

### 4 代码理解

适用看代码说问题、输出结果、手写实现。正面：一段代码 +
`这段代码有什么问题？/ 输出是什么？/ 补全空白部分`

```
结论（一句话）
---
解释为什么
```

### 5 模式识别（算法）

适用算法套路索引。正面：`题目特征描述 → 用什么思路？`

```
套路名称
---
适用信号（2-3 条，看到这些就该想到它）
---
核心代码框架（骨架，不是完整解）
```

### 6 数据结构选型

适用给定场景选数据结构。正面：`场景描述 → 用什么数据结构？为什么？`

```
结构名 + 一句话理由
---
关键操作的复杂度
---
反例：什么时候不该用它
```

## 约定

- 卡组用 `::` 嵌套命名（如 `面试::React`），对应 Anki 中的树形结构
- 数学符号用 MathJax——纯文本渲染，跨平台一致；不用 LaTeX（依赖 PC
  客户端预生成图片，移动端才能显示）

## AnkiConnect API

所有调用都是 `POST http://localhost:8765`，body
`{"action": "...", "version": 6, "params": {...}}`。常用 action：

- `deckNames` / `modelNames` — 列卡组与 note type，写入前确认目标存在
- `findNotes` — 查重，query 语法同 Anki 搜索框
- `addNote` — 单条写入，duplicate 直接报错
- `addNotes` — 批量写入

```bash
curl -s localhost:8765 -d '{
  "action": "addNote", "version": 6,
  "params": {"note": {
    "deckName": "面试::React", "modelName": "Basic",
    "fields": {"Front": "...", "Back": "..."}
  }}
}'
```

## 工作流

1. 过滤选题，按模版起草卡片
2. `deckNames` / `modelNames` 确认目标卡组与 note type
3. `findNotes` 查重，剔除已有卡片
4. 列出将建卡片全文，等用户确认
5. `addNotes` 批量写入，核对返回的 note id 无 null
