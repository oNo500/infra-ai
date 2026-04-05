---
name: markdown
description: >
  Markdown syntax reference for writing and editing documentation. Use when writing or updating
  README files, .md documents, GitHub wiki pages, PR descriptions, or any markdown content.
  Covers CommonMark, GFM (GitHub Flavored Markdown), and GitHub-specific extensions (alerts,
  Mermaid, math, collapsible sections, auto-links).
  Trigger phrases: "update README", "write docs", "write markdown", "edit .md", "add to README".
---

# Markdown

Full syntax reference (headings, lists, tables, alerts, Mermaid, math, etc.): [references/syntax.md](references/syntax.md)

## Quick Rules

- Blank line between paragraphs and before/after headings, lists, code blocks
- Indent nested list items with 2 spaces
- Fenced code blocks with language tag for syntax highlighting (` ```ts `, ` ```bash `, etc.)
- Prefer `**bold**` over `__bold__`, `*italic*` over `_italic_` (less ambiguous in prose)
- Use `---` for horizontal rules and front matter delimiters
- Escape special characters with `\` when not intending markdown syntax
