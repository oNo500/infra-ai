---
name: obsidian-bases
description: >-
  Creates and edits Obsidian .base files (native database views over
  frontmatter). Use when aggregating vault notes into table/card views,
  building maintenance dashboards, or when dataview-style queries are
  requested in the user's vault.
---

# obsidian-bases

在用户的 Obsidian 库里创建与编辑 `.base` 文件（Obsidian 1.9+ 原生数据库
视图）。分工：建档规范（frontmatter schema、路由、命名）归 note skill，
Obsidian 私有语法归 obsidian-markdown skill；本 skill 只覆盖 bases——
一种按 frontmatter 聚合笔记的视图配置。

## 文件模型

`.base` 是一个 YAML 配置文件，数据仍在 markdown 笔记的 frontmatter 里；
一个文件 = 一个查询 + 多个视图。核心四件：

- `filters`：按 frontmatter / 文件属性筛选，表达式可用 `and` / `or` /
  `not` 递归组合
- `views`：视图列表，`table` 或 `cards`；每个视图可再叠自己的
  `filters`、列顺序 `order`、排序 `sort`、条数 `limit`
- `formulas`：派生计算字段，视图里以 `formula.<name>` 引用
- summaries：表格列聚合（Sum / Average / Count 等，显示在视图底部）

## 本库立场

- 优先 bases 而非 dataview——无插件依赖、配置可读
- 与 MOC 分工：MOC 是人工策展的概念地图，bases 是按 frontmatter
  聚合的机器视图，互补不互替

## 生成前校验

生成 `.base` 前先确认目标笔记的 frontmatter 字段真实存在——本库
schema（`type`、`tags`、`jd_id`、`created` 等）见 note skill。
引用不存在的字段不会报错，只会得到空列，错误静默。

## 典型场景

- 按 `type` 聚合全部 concept
- 按 lifecycle tag 列出 draft 待完善清单
- 按 `jd_id` 区域聚合某个 PARA 段

## 最小示例

按 type 聚合全部 concept，排除 stub，按创建时间倒序：

```yaml
filters:
  and:
    - type == "concept"
    - '!tags.contains("stub")'
views:
  - type: table
    name: All concepts
    order:
      - file.name
      - title
      - created
      - tags
    sort:
      - property: created
        direction: DESC
```
