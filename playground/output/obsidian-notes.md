# Obsidian PKM 规则

Obsidian vault 内所有笔记 MUST 遵循本文件。

**架构基线**：PARA（Tiago Forte，Build a Second Brain）+ Johnny Decimal 编号 + Zettelkasten 原子化原则，落地于 Obsidian + YAML frontmatter + Wikilinks。

本文件遵循 RFC 2119 关键词：MUST / MUST NOT / SHOULD / SHOULD NOT / MAY。

执行任何笔记写入前，AI MUST 在 `<knowledge_thought>` 标签内评估当前任务，确认遵循路径后再写入。评估 MUST 覆盖：归属哪个 PARA 目录、是否需要新建 vs 并入已有笔记、文件命名是否符合 §Naming、frontmatter 是否完整、是否触发 §Human-in-the-loop。

## Routing（PARA + Johnny Decimal）

目录映射：

- `00-inbox` — 未分类捕获
- `10-projects` — 有截止日期的活跃项目
- `20-areas` — 长期维护的责任领域
- `30-resources` — 主题参考资料
- `90-archive` — 完成或冷冻的内容（按 `90/{YYYY}` 归档）
- `99-system` — 系统模板与配置

决策链：

```
模板 / 系统 → 99
有 deadline → 10
已完成 → 90/{YYYY}
活跃维护 → 20
仅参考 → 30
不确定 → 00
```

## Naming

### 目录

- 最多 2 级深度
- MUST 用 `kebab-case`（全小写，零例外）

### 文件

格式：`{Area}-{Type}-{Theme}.md`

- **Area**：自定义缩写 SHALL `UPPERCASE`（`JS` / `TS` / `API` / `DSA`）；技术品牌 SHALL Brand Casing（`React` / `NestJS`）
- **Type**（严格枚举）：`concept` | `cheatsheet` | `practice` | `reference` | `note` | `book`
- **Theme**：中文 MUST 全小写；英文 SHALL Brand Casing

### 特殊文件

- MOC：`00-MOC-{Theme}.md`
- Dailies：`YYYY-MM-DD.md`

### 禁止

- MUST NOT 使用空格、`! | ? * :`
- MUST NOT 命名为 `temp` / `untitled`

## Frontmatter Schema

每篇笔记 MUST 含完整 frontmatter：

```yaml
---
title: <Document Title>
jd_id: JXX-YYYYMMDD-HHMM
created: YYYY-MM-DD HH:MM
origin: <Source>
tags: [draft] # progression: draft → growing → evergreen
---
```

`jd_id` 与 `created` MUST 通过 shell 命令获取，MUST NOT 凭空生成：

```bash
TZ='Asia/Shanghai' date '+%Y-%m-%d %H:%M'
```

## Authoring Conventions

### Structure

笔记结构 SHALL 遵循 MECE 原则（Mutually Exclusive, Collectively Exhaustive）：

- 章节互斥：同一概念 MUST NOT 出现在多个章节
- 章节完备：MUST 覆盖主题的所有必要维度
- Outline-first：MUST 先定义标题层级与逻辑流，再生成内容

### Layout

- 单文件 SHOULD < 200 行
- 超过 500 行 MUST 拆分
- MOC MUST ≤ 150 行

### Markdown 元素

- Callouts SHALL 用 Obsidian 扩展语法：`[!warning]` / `[!faq]-`（折叠）/ `[!tip]+`（展开）
- 关键术语 MUST 用 `==高亮==`
- 跨文件精确引用 SHALL 用 `^block-id`
- 双向链接 SHALL 用 `[[Concept]]`，构建知识图谱

### Dividers

- `---` MUST NOT 置于 heading 之间
- `---` 仅用于段落内重大内容跳转

## Knowledge Graph Integrity

- Single Source of Truth：MUST 引用已有笔记，MUST NOT 重复创建同概念
- Atomic Focus：单笔记 MUST 聚焦单一主题
- Fact-grounded：MUST 基于提供的上下文或可验证来源，MUST NOT 幻觉
- 重命名 heading 或文件 MUST 同步更新所有反向引用
- 创建新 tag / category 前 MUST 检索已有，避免同义污染

## Information Retrieval

知识发现优先级：Local RAG → Exa（深度研究） → Brave Search（通用兜底）。

精确术语匹配 SHALL 用 `rg`，概念发现 SHALL 用语义搜索。

## Anti-patterns

- MUST NOT 在 frontmatter 凭空填 `jd_id` / `created`（必须 shell 命令获取）
- MUST NOT 跨笔记重复同一概念（违反 Single Source of Truth）
- MUST NOT 单笔记承载多主题（违反 Atomic Focus）
- MUST NOT 无来源引用陈述事实（违反 Fact-grounded）
- MUST NOT 重命名后不更新反向引用（破坏知识图谱）
- MUST NOT 创建同义 tag / category

## Human-in-the-loop

- 笔记归属判断模糊（既像 project 又像 area）— PARA 边界判定，停下确认
- 跨笔记重复出现（可能合并 / 可能拆分）— 知识架构演进决策
- frontmatter 缺少必要 origin / 上下文 — 信息溯源缺失，请求补充
