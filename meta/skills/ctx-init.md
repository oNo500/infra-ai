---
name: ctx-init
status: ready
---

# 元指令：ctx-init skill

在目标项目初始化 Claude Code 配置的指路 skill：教 AI 用 iuse（使用端 CLI）
走完「探测 → 选型 → 预演 → 执行」的决策流，iuse 不可用时降级手动流程。
前身是内嵌五步流程的旧版（iuse 落地后改写为指路，2026-07-17）。

## frontmatter

```yaml
name: ctx-init
description: >-
  Initializes Claude Code configuration for a project from the infra-ai
  central source using the iuse CLI (detect -> pick profile -> dry-run ->
  init), with a manual fallback when iuse is unavailable. Use when setting
  up .claude/ config for a new or existing project, as an alternative to
  claude init.
---
```

## 正文素材（AI 决策流）

1. 探测：`which iuse`——不可用则走文末降级流程
2. 选型：`iuse profiles --json` 列出可选组合；对照项目事实
   （package.json 依赖、语言、框架）选最接近的 profile；
   拿不准时问用户，MUST NOT 自造组合
3. 预演：`iuse init --profile <p> --dry-run --json <target>`——把计划
   （将拷贝的 rules、将实例化的模板）复述给用户确认；dry-run 零写入
   （远程源会拉快照到缓存，属读侧操作）
4. 执行：`iuse init --profile <p> <target>`；实例化失败时按提示
   `--force` 重跑补齐
5. 验证与后续：`iuse status` 应全 synced 退出 0；此后拉中心源更新用
   `iuse update`（本地改过的副本默认跳过，提示带回中心仓）

退出码语义：status 有任何非 synced 退 1；init/update 成功退 0。
全命令支持 `--json`（单行对象，均含 ok；各命令数据字段不同：
init/update 带 message/steps、status 带 rows/exitCode、profiles 带 profiles）。

降级流程（无 iuse 时）：

- 中心源默认 `~/code/infra-ai`（或 INFRA_AI_ROOT）；读 `profiles.json`
  选 profile，把清单内每条 rule 从 `rules/global|scoped/` 拷到目标
  `.claude/rules/<name>.md`，拷 `templates/settings.json`
- 参照 `templates/architecture.md` 与 `templates/claude-md.md` 结合项目
  事实实例化（占位符全替换、不适用章节整节删、CLAUDE.md <50 行）
- 提醒用户装 iuse（infra-ai 仓 `packages/iuse` 内 `pnpm link --global`）
  以获得对账与更新能力

## 产物要求

- 只生成 `skills/ctx-init/SKILL.md`；决策流可复制为 checklist；
  命令均给单行示例
