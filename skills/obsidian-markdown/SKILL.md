---
name: obsidian-markdown
description: >-
  Obsidian-only markdown extensions reference -- wikilinks, embeds,
  callouts, block IDs, properties, comments. Use when writing or
  editing notes inside an Obsidian vault and Obsidian-specific syntax
  is needed.
---

# obsidian-markdown

仅在 Obsidian 渲染器中生效的私有扩展语法。分工：通用 markdown 写作约定归
markdown rule，GitHub 扩展归 edit-markdown skill，本 skill 只覆盖 Obsidian
私有语法及本库使用约定。

## Wikilink（内部链接）

```markdown
[[文件名]]
[[文件名|别名]]
[[文件名#章节]]
[[文件名#^block-id]]
```

- 只写文件名，不含路径（Obsidian 自动解析）
- `#` 链接到标题，`#^` 链接到 block ID

## Embed（嵌入）

```markdown
![[文件名]]            嵌入整篇笔记
![[文件名#章节]]       嵌入某个章节
![[文件名#^block-id]]  嵌入某个块
![[图片.png]]          嵌入图片
![[图片.png|300]]      嵌入图片并指定宽度
![[音频.mp3]]          嵌入音频
![[视频.mp4]]          嵌入视频
![[文件.pdf]]          嵌入 PDF
![[文件.pdf#page=3]]   嵌入 PDF 第 3 页
```

## Callout（标注块）

```markdown
> [!NOTE]
> 内容

> [!NOTE] 自定义标题
> 内容

> [!NOTE]+ 默认展开的可折叠块
> 内容

> [!NOTE]- 默认折叠的可折叠块
> 内容
```

折叠控制：`+` 默认展开，`-` 默认折叠，不加则不可折叠。

内置类型（同一组视觉相同）：

- `note` / `info`
- `tip` / `hint` / `important`
- `success` / `check` / `done`
- `question` / `help` / `faq`
- `warning` / `caution` / `attention`
- `failure` / `fail` / `missing`
- `danger` / `error`
- `bug`
- `example`
- `quote` / `cite`

## Block ID（块引用）

```markdown
这是一个段落 ^my-block-id

- 列表项 ^list-item
```

在其他文件中用 `[[文件名#^my-block-id]]` 引用，或用 `![[文件名#^my-block-id]]` 嵌入。

## Properties（front matter）

```yaml
---
title: 标题
tags:
  - tag1
  - tag2
aliases:
  - 别名1
cssclasses:
  - wide-page
publish: false
---
```

- Obsidian 1.4+ 将 YAML front matter 呈现为 Properties，支持 GUI 编辑
- 属性类型：`text`、`list`（tags、aliases 等）、`number`、`checkbox`、
  `date`（`YYYY-MM-DD`）、`datetime`
- 内置属性：`tags` `aliases` `cssclasses` `publish`

## 注释（不渲染、不导出）

```markdown
%%
这段内容不会渲染，也不会导出
%%

文字 %% 行内注释 %% 文字
```

## 行内脚注

```markdown
正文^[脚注内容直接写在这里]
```

GFM 不支持此语法；标准脚注 `[^1]` 属通用 markdown 语法，不在本 skill 范围。

## 本库使用约定

在上述语法之上，本 vault 内写作遵循：

- callout 每篇 0-2 个，只给关键边界，不做装饰
- 嵌入 `![[]]` 仅在需要原文复现时使用，其余场景用普通 wikilink
- 不使用嵌套 tag（`type/concept` 形式禁止）
- wikilink 显示名剥离 prefix 段，如 `[[Markdown-Obsidian扩展语法|Obsidian扩展语法]]`
