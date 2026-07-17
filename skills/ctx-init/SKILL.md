---
name: ctx-init
description: >-
  Initializes Claude Code configuration for a project from the infra-ai
  central source using the iuse CLI (detect -> pick profile -> dry-run ->
  init), with a manual fallback when iuse is unavailable. Use when setting
  up .claude/ config for a new or existing project, as an alternative to
  claude init.
---

# ctx-init

用 iuse（infra-ai 使用端 CLI）在目标项目初始化 Claude Code 配置。本 skill
只做决策指路：探测 → 选型 → 预演 → 执行 → 验证，拼装本身由 iuse 完成；
iuse 不可用时走文末降级流程。

## 决策流

复制此 checklist 并逐步完成：

```
Progress:
- [ ] Step 1 探测：iuse 可用性
- [ ] Step 2 选型：列出 profiles，对照项目事实选一个
- [ ] Step 3 预演：dry-run，向用户复述计划并确认
- [ ] Step 4 执行：init（实例化失败按提示 --force 重跑）
- [ ] Step 5 验证：status 全 synced；后续更新走 update
```

### Step 1 探测

`which iuse` — 不可用则跳到「降级流程」。

### Step 2 选型

`iuse profiles --json` 列出可选组合。对照项目事实（package.json 依赖、
语言、框架）选最接近的 profile；拿不准时问用户，MUST NOT 自造组合。

### Step 3 预演

`iuse init --profile <p> --dry-run --json <target>`

把计划（将拷贝的 rules、将实例化的模板）复述给用户确认。dry-run 零写入
（远程源会拉快照到缓存，属读侧操作）。

### Step 4 执行

`iuse init --profile <p> <target>`

实例化失败时按提示 `--force` 重跑补齐。

### Step 5 验证与后续

`iuse status` 应全 synced 且退出 0。此后拉中心源更新用 `iuse update`：
本地改过的副本默认跳过，提示带回中心仓。

## 命令语义

- 退出码：`status` 有任何非 synced 退 1；`init`/`update` 成功退 0
- 全命令支持 `--json`，输出单行 JSON 对象，均含 `ok`；数据字段各命令
  不同：`init`/`update` 带 `message`/`steps`，`status` 带
  `rows`/`exitCode`，`profiles` 带 `profiles`

## 降级流程（无 iuse 时）

- 中心源默认 `~/code/infra-ai`（可用 `INFRA_AI_ROOT` 覆盖），下文记 `$SRC`
- 读 `$SRC/profiles.json` 选 profile；把清单内每条 rule 从
  `$SRC/rules/global|scoped/` 拷到目标 `.claude/rules/<name>.md`；
  拷 `$SRC/templates/settings.json` 到 `.claude/settings.json`
- 参照 `$SRC/templates/architecture.md` 与 `$SRC/templates/claude-md.md`
  结合项目事实实例化：占位符全替换、不适用章节整节删、CLAUDE.md <50 行
- 提醒用户装 iuse 以获得对账与更新能力：infra-ai 仓 `packages/iuse` 内
  `pnpm link --global`
