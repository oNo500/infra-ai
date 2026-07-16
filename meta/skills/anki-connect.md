---
name: anki-connect
status: ready
---

# 元指令：anki-connect skill

把学习材料做成 Anki 卡片并经 AnkiConnect API 写入。制卡方法论素材：
notes 仓 `20-areas/20-06-学习与成长/Anki-面试卡片模版.md`（构建时读取
六模版的背面结构细节）、`Anki-配置速查.md`、`30-resources/30-04-APP/Anki.md`。

## frontmatter

```yaml
name: anki-connect
description: >-
  Turns study material into Anki cards following the user's card
  templates and adds them via the AnkiConnect API (localhost:8765).
  Use when asked to make flashcards, add notes to Anki, or convert
  notes/interview prep into spaced-repetition cards.
---
```

## 正文素材

选题原则（先过滤再制卡）：

- 入卡：原理、对比、易混淆、高频考点
- 不入卡：速查列表、代码片段、工具操作步骤——查笔记比背 Anki 合适
- 算法只建模式索引卡，不替代刷题

六种卡片模版（背面结构构建时从笔记补全）：
概念解释、对比辨析、场景诊断、代码理解、模式识别、数据结构选型。

约定：卡组用 `::` 嵌套命名（如 `面试::React`）；数学符号用 MathJax
（跨平台一致）。

AnkiConnect API（Anki 需运行且装 AnkiConnect 插件）：

- `POST http://localhost:8765`，body `{"action": "...", "version": 6, "params": {...}}`
- 常用 action：`deckNames`、`modelNames`、`addNote`（duplicate 会报错，
  先 `findNotes` 查重）、`addNotes` 批量
- 写入前列出将建卡片给用户确认，不静默批量写

## 产物要求

- 只生成 `skills/anki-connect/SKILL.md`
