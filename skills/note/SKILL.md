---
name: note
description: >-
  Creates notes in the user's Obsidian vault following its conventions --
  frontmatter schema, jd_id generation, PARA/JD routing, naming and
  wikilink rules. Use when asked to create, file or normalize a note
  in ~/code/notes.
---

# note

在用户的 Obsidian 笔记库（`~/code/notes`）里创建符合库规范的笔记。
分工：通用 markdown 写作约定归 markdown rule，Obsidian 私有语法归
obsidian-markdown skill；本 skill 只覆盖建档规范——frontmatter schema、
JD/PARA 路由、命名、wikilink 与文件操作。

## Frontmatter schema（缺一不可）

```yaml
---
title: 中文标题
jd_id: JXX-YYYYMMDD-HHMM
created: YYYY-MM-DD HH:MM
type: concept
tags: [draft, 分类tag]
---
```

- `title`：中文
- `jd_id`：格式 `JXX-YYYYMMDD-HHMM`。时间部分 MUST NOT 手编——用
  `TZ='Asia/Shanghai' date '+%Y%m%d-%H%M'` 生成；`XX` 取区域号
  （00/10/20/30/90/99），与路由结果一致
- `created`：`TZ='Asia/Shanghai' date '+%Y-%m-%d %H:%M'` 生成
- `type`：六枚举之一——`concept` / `cheatsheet` / `practice` /
  `reference` / `note` / `book`
- `tags`：首位必须是 lifecycle tag——`stub` / `draft` / `growing` /
  `evergreen` / `moc`，其后为分类 tag

文件首字符必须是 `---`，前面不能有空行，否则 Obsidian 不识别 Properties。

## JD/PARA 路由

按序判断，命中即停：

- 系统配置/模板 → `99-system`
- 有截止日期 → `10-projects`
- 已完成 → `90-archive/{年}`
- 活跃关注 → `20-areas`
- 纯参考资料 → `30-resources`
- 拿不准 → `00-inbox`

目录 kebab-case，最深两级。

## 文件命名

格式 `{prefix}-{theme}.md`：

- 缩写全大写（AI / JS / TS），品牌保持原大小写（React / NestJS）
- theme 已含 prefix 时去重，不写成 `AI-AI编码.md` 这类重复形式

## Wikilink 与文件操作

- wikilink 用 `[[file-name|显示名]]`，显示名剥离 prefix 段；只用文件名，
  不用路径
- 不手动维护反链
- 移动/重命名 MUST 走 obsidian-cli（见 obsidian-cli skill），
  禁用 `mv` / `cp` / `rm`——直接操作文件会破坏 wikilink
