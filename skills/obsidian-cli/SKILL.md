---
name: obsidian-cli
description: >-
  Operates the user's Obsidian vault via obsidian-cli (NotesMD CLI) --
  link-safe file moves, content search, vault audit commands, theme
  debugging. Use for any file move/rename in ~/code/notes, vault-wide
  search, or broken-link auditing.
---

# obsidian-cli

用 obsidian-cli（NotesMD CLI，原 Yakitrak）操作用户的 Obsidian 笔记库
（`~/code/notes`）。分工：建档规范归 note skill，Obsidian 私有语法归
obsidian-markdown skill；本 skill 只覆盖 CLI 操作——链接安全的文件
移动、全文检索、坏链审计与主题调试。

## 红线

- vault 内文件移动/重命名 MUST 走 `obsidian-cli move`——它会自动更新
  反向链接；手动 `mv` / `cp` / `rm` 会造成坏链
- 修复/移动后 MUST 验证链接存活：用旧文件名跑 `search-content`，
  确认无残留引用

## 命令面

- `obsidian-cli move <旧> <新>` — 改名/移动，反链安全
- `obsidian-cli search-content <词>` — 全文检索，审计勘探的主力
- CLI 直接读写 vault 文件，Obsidian 未运行时同样可用（NotesMD CLI
  特性），无需先开应用

## 主题调试

三件套循环，直到渲染符合预期：

1. reload vault——让主题/CSS 改动生效
2. eval CSS 变量——读取变量实际取值，确认改动落到了目标元素
3. 截图——核对最终渲染结果

## 维护工作流

- 「建」与「维护」分开做，不混在同一次操作里
- 修复排序：硬伤（坏链、孤岛）优先于预防性维护
- 孤岛/坏链排查配 find-unlinked-files 插件：
  - 排除 `99-system/`、`00-inbox/`、`90-archive/`
  - 删除前先 `git commit`，留回滚点
  - MOC 类笔记易被误判为孤岛，人工甄别后再处理
