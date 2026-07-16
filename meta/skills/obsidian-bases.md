---
name: obsidian-bases
status: ready
---

# 元指令：obsidian-bases skill

Obsidian bases（1.9+ 原生数据库视图，`.base` 文件）的使用约定。
素材：notes 仓 `30-resources/30-06-glossary/glossary-bases.md`。

## frontmatter

```yaml
name: obsidian-bases
description: >-
  Creates and edits Obsidian .base files (native database views over
  frontmatter). Use when aggregating vault notes into table/card views,
  building maintenance dashboards, or when dataview-style queries are
  requested in the user's vault.
---
```

## 正文素材

- `.base` = YAML 配置文件（数据仍在 markdown 笔记里）：一个文件 =
  一个查询 + 多个视图；核心四件：filters（按 frontmatter 筛选）、
  views（table/card）、formulas（派生计算字段）、summaries（聚合）
- 立场：本库优先 bases 而非 dataview——无插件依赖、配置可读
- 与 MOC 分工：MOC 是人工策展的概念地图，bases 是按 frontmatter
  聚合的机器视图，互补不互替
- 典型场景：按 type 聚合全部 concept、按 lifecycle 列出 draft 待完善、
  按 jd_id 区域聚合某 PARA 段
- 生成 .base 前先确认目标笔记的 frontmatter 字段真实存在
  （schema 见 note skill）

## 产物要求

- 只生成 `skills/obsidian-bases/SKILL.md`；给一个最小 .base YAML 示例
