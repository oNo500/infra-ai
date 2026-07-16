---
name: obsidian-markdown
status: ready
---

# 元指令：obsidian-markdown skill

Obsidian 私有 markdown 扩展语法参考（懒加载）。分工：通用 markdown
写作约定归 markdown rule，GitHub 扩展归 edit-markdown skill，本 skill
只覆盖仅在 Obsidian 渲染器生效的私有语法。

## frontmatter

```yaml
name: obsidian-markdown
description: >-
  Obsidian-only markdown extensions reference -- wikilinks, embeds,
  callouts, block IDs, properties, comments. Use when writing or
  editing notes inside an Obsidian vault and Obsidian-specific syntax
  is needed.
---
```

## 正文素材

构建时读取 notes 仓
`~/code/notes/20-areas/20-04-tech-tree/markdown/Markdown-Obsidian扩展语法.md`
整合为语法参考，覆盖：wikilinks（含别名与标题锚点）、嵌入 `![[]]`、
callouts（类型清单与折叠语法）、block ID `^id`、Properties、
`%% 注释 %%`、行内脚注。

叠加本库使用约定（与语法参考并列成节）：

- callout 每篇 0-2 个，只给关键边界，不装饰
- 嵌入 `![[]]` 仅在需要原文复现时用
- 不使用嵌套 tag（`type/concept` 形式禁止）
- wikilink 显示名剥离 prefix 段

## 产物要求

- 生成 `skills/obsidian-markdown/SKILL.md`（可含 references/ 如内容超长）
