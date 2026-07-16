---
name: note
status: ready
---

# 元指令：note skill

在用户的 Obsidian 笔记库（~/code/notes）里创建符合库规范的笔记。
素材：vault 根 README 的规范速查、`99-system/templates/_tpl-note.md`、
本仓 markdown rule 已覆盖的写作约定不重复。

## frontmatter

```yaml
name: note
description: >-
  Creates notes in the user's Obsidian vault following its conventions --
  frontmatter schema, jd_id generation, PARA/JD routing, naming and
  wikilink rules. Use when asked to create, file or normalize a note
  in ~/code/notes.
---
```

## 正文素材

frontmatter schema（缺一不可）：

- `title`（中文）、`jd_id`、`created`、`type`（六枚举：concept/cheatsheet/
  practice/reference/note/book）、`tags`（首位必须是 lifecycle：
  stub/draft/growing/evergreen/moc，其后为分类）
- `jd_id` 格式 `JXX-YYYYMMDD-HHMM`，MUST NOT 手编——用
  `TZ='Asia/Shanghai' date '+%Y%m%d-%H%M'` 生成时间部分，XX 取区域号
  （00/10/20/30/90/99）
- 文件首字符必须是 `---`，前面不能有空行

路由与命名：

- JD/PARA 路由决策：系统/模板→99；有截止日→10；已完成→90/{年}；
  活跃→20；纯参考→30；拿不准→00-inbox
- 文件名 `{prefix}-{theme}.md`：缩写全大写（AI/JS/TS）、品牌保持原大小写
  （React/NestJS）；theme 已含 prefix 时去重
- 目录 kebab-case，最深两级

链接与工具：

- wikilink 用 `[[file-name|显示名]]`，显示名剥离 prefix 段；只用文件名
  不用路径；不手动维护反链
- 移动/重命名 MUST 走 obsidian-cli（见 obsidian-cli skill），禁 mv/cp/rm

## 产物要求

- 只生成 `skills/note/SKILL.md`
