---
name: edit-markdown
status: ready
---

# 元指令：edit-markdown skill

Markdown 语法参考（懒加载）。分工：写作姿态与约定归 markdown rule
（rules/scoped/markdown.md），本 skill 只提供语法层速查——CommonMark、
GFM、GitHub 专属扩展（alerts、Mermaid、math、details、autolink）。

## frontmatter

```yaml
name: edit-markdown
description: >-
  Markdown syntax reference covering CommonMark, GFM and GitHub-only
  extensions (alerts, Mermaid, math, collapsible sections, autolinks).
  Use when writing or editing README files, .md documents, wiki pages
  or PR descriptions and exact syntax is needed.
---
```

## 正文素材

- SKILL.md 本体保持简短：快速规则（段落/标题/列表/代码块间空行、
  嵌套列表缩进 2 空格、代码块带语言标签、`**bold**`/`*italic*` 优先、
  特殊字符用 `\` 转义）+ 指向 references/syntax.md
- `references/syntax.md`：完整语法参考。构建时读取 notes 仓
  `~/code/notes/20-areas/20-04-tech-tree/markdown/Markdown-语法速查.md`
  与 `Markdown-GitHub扩展语法.md`，按 CommonMark 基础 → GFM 扩展 →
  GitHub 专属三层整合
- 注意与 markdown rule 不冲突：语法参考里表格语法照常收录（这是语法
  事实），但示例场景注明本仓写作约定优先列表

## 产物要求

- 生成 `skills/edit-markdown/SKILL.md` + `references/syntax.md` 两个文件
