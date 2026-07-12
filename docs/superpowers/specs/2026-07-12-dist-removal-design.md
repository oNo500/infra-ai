# meta-cli 分发职责摘除 — Design

## Problem

维护端/使用端职责边界——推送式分发越界且与使用端拉取模型冲突。
meta-cli 是维护本仓自身资产的工具（构建、对账、回写、skills 账），
把「推送到下游项目」也塞进同一个工具，混淆了两侧职责：下游项目的
订阅关系、拉取时机应由下游自己的工具决定，不该由上游仓库登记推送。

## Decisions

- 摘除 dist/targets 动作与 targets.json、总览下游列——`dist`、
  `targets:list/add/remove/subscribe/unsubscribe` 六个动作、
  `core/dist.ts`、TUI 的 targets 视图与 `d`/`D`/`t` 键位、
  `OverviewRow`/`StatusRowData` 的 downstream/targets 字段全部移除。
  ACTIONS 收敛为 `status, adopt, build, writeback, skills:status,
  skills:fix, skills:update` 七个，均为本仓资产维护动作。
- 分发迁往使用端 CLI（拉取式，订阅关系活在下游）——下游项目自己决定
  订阅哪些 rule、何时拉取，不再由 infra-ai 一侧登记 targets.json 推送。
- `core/dist.ts` 随之删除，git 历史保留——功能不是永久丢弃，是转移
  到另一个尚未立项的工具；需要时从历史找回参考实现。

## Supersedes

本决定推翻以下文档中的分发相关部分，其余决定不受影响：

- `2026-07-11-meta-cli-design.md` Decision 3（`targets.json` 登记与
  `dist` 分发）与 Decision 5 的分发相关部分
- `2026-07-11-meta-cli-command-mode-design.md` 命令面中的
  `meta dist` 与 `meta targets ...` 子命令
