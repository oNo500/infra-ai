---
name: edit-markdown
description: >-
  Markdown syntax reference covering CommonMark, GFM and GitHub-only
  extensions (alerts, Mermaid, math, collapsible sections, autolinks).
  Use when writing or editing README files, .md documents, wiki pages
  or PR descriptions and exact syntax is needed.
---

# edit-markdown

Markdown 语法速查。写作姿态与本仓约定归 markdown rule
（`rules/markdown.md`），本 skill 只回答「这个语法怎么写」。

## 快速规则

- 段落、标题、列表、代码块之间各留一个空行
- 嵌套列表缩进 2 空格
- 代码块必须带语言标签：`` ```ts ``、`` ```bash ``、`` ```diff ``
- 粗体用 `**bold**`、斜体用 `*italic*`（不用 `__` / `_` 变体）
- 需要按字面输出的特殊字符用 `\` 转义：`\*`、`\[`、`` \` ``

## 完整参考

查具体写法读 [references/syntax.md](references/syntax.md)，按三层组织：

- CommonMark 基础：标题、文本格式、列表、链接、引用、代码块、转义
- GFM 扩展：表格、删除线、任务列表、URL autolink、脚注
- GitHub 专属：alerts、折叠块、数学公式、Mermaid、引用 autolink
  （`#123` / `@user` / SHA）、GeoJSON / STL
