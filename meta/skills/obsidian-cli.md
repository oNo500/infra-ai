---
name: obsidian-cli
status: ready
---

# 元指令：obsidian-cli skill

obsidian-cli（NotesMD CLI，原 Yakitrak）操作用户笔记库的约定与命令面。
素材：notes 仓 README 硬规则、`10-projects/10-02-pkm/PKM-维护流程.md`、
quietpaper 主题调试实战。

## frontmatter

```yaml
name: obsidian-cli
description: >-
  Operates the user's Obsidian vault via obsidian-cli (NotesMD CLI) --
  link-safe file moves, content search, vault audit commands, theme
  debugging. Use for any file move/rename in ~/code/notes, vault-wide
  search, or broken-link auditing.
---
```

## 正文素材

红线：

- vault 内文件移动/重命名 MUST 走 `obsidian-cli move`——自动更新反向
  链接；手动 `mv`/`cp`/`rm` 会造成坏链
- 修复/移动后 MUST 验证链接存活（搜索旧名确认无残留引用）

命令面：

- `obsidian-cli move <旧> <新>` — 改名/移动（反链安全）
- `obsidian-cli search-content <词>` — 全文检索，审计勘探主力
- 可在 Obsidian 未运行时操作 vault（NotesMD CLI 特性）
- 主题调试三件套：reload vault、eval CSS 变量、截图

维护工作流（PKM-维护流程）：

- 「建」与「维护」分开做；修复排序：硬伤（坏链、孤岛）优先于
  预防性维护
- 孤岛/坏链排查配 find-unlinked-files 插件：排除 99-system/00-inbox/
  90-archive，删除前先 git commit，MOC 类误判人工甄别

## 产物要求

- 只生成 `skills/obsidian-cli/SKILL.md`
