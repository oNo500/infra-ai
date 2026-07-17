# iuse 使用端 CLI — Design

第二个 CLI（2026-07-11 两 CLI 规划的下半场）：从 infra-ai 中心源向目标项目
拼装配置。消费 profiles.json，落下游账，做下游对账与更新。维护端边界不变：
iuse 对中心源只读，不做构建/回写。

## Problem

- rule/skill/template 资产与 profile 组合已就绪，但没有消费端：分发靠手动
  copy，无登记、无对账、无更新通路
- 组合 spec 预告的分发基线（profile 版本 + rule hash）无处安放
- `scripts/init-project.sh` 只拷两个文件，配不上现有资产面

## Decisions

1. **形态**——`packages/iuse`（bun + citty，纯命令式，无 TUI），bin `iuse`
   经 `pnpm link --global` 分发。分层沿用 meta-cli 惯例：`src/core/`
   （纯逻辑，副作用经注入的 ctx）+ `src/cli/`。profile/composition 解析
   复用 `@infra-ai/meta-cli/core` barrel（按需扩导出），不重复实现。

2. **中心源解析链**——`--source <path|gh:owner/repo[#ref]>` 显式 >
   `INFRA_AI_ROOT` env > 默认 `~/code/infra-ai`；本地路径校验
   `profiles.json` 存在。远程走 giget 拉快照到缓存目录（复用 meta-cli 的
   download 注入模式）并记录 commit。本地优先、离线可用。

3. **命令面（MVP 三个）**：
   - `iuse init --profile <name> [target]`——默认 target 为 cwd。流程：
     解析源 → 对源跑 composition 校验（违规拒绝）→ profile 内每条 rule
     从 `rules/global|scoped/` 拷到 `<target>/.claude/rules/<name>.md`
     （global/scoped 同目录，scoped 靠自身 paths frontmatter 生效）→
     拷 `templates/settings.json` 到 `.claude/settings.json` → AI 实例化
     `templates/architecture.md` → `.claude/rules/architecture.md`、
     `templates/claude-md.md` → 根 `CLAUDE.md`（最后生成）→ 落下游账。
     目标已有下游账时报错并指向 update；`--force` 允许重跑（幂等：
     同内容跳过，实例化产物已存在时不覆盖）
   - `iuse status`——逐 rule 三态对账：`synced`（副本 = 基线 = 源）、
     `modified`（副本 ≠ 基线：下游被改，按「下游不回改」红线提示带回
     中心或接受覆盖）、`outdated`（基线 ≠ 源当前产物）；模板只报
     instantiated 事实不对账。语义化退出码：有 modified/outdated 退 1
   - `iuse update`——outdated 且未 modified 的拷新版并更新账；
     modified 的跳过并警告，`--force` 才覆盖；模板不参与 update
     （实例化产物已项目化）

4. **下游账 `<target>/.claude/infra-ai.lock.json`**（分发基线登记）：
   `{ source: { type: "local"|"remote", id: "<版本标识>", locator: "<路径|gh:...>" },
   profile, appliedAt, rules: { "<name>": "<sha256>" },
   templates: ["architecture", "claude-md"] }`。它是下游唯一事实入口，status/update 全部据此对账。
   版本标识分通道：本地源记 git HEAD（脏工作区时记 `<hash>-dirty` 并
   警告）；远程源记 giget 请求的 ref（未指定则 `main`）——快照无 git，
   不追精确 commit，对账以 rules 内容 hash 为准（hash 才是基线本体，
   版本标识只作溯源提示）。

5. **AI 模板实例化**——与 imeta 同模式 spawn `claude -p` headless。
   契约文档 `meta/prompts/template-instantiate.md` 住中心源，iuse 从源
   读取；prompt 指针引用契约 + 模板文件 + 目标项目路径。每个模板独立
   一次 claude 调用。落位分工：CLAUDE.md 与 `.claude/**` 是 Claude Code
   权限系统的敏感文件，headless 的 allowedTools 无法放行直写——claude
   只写目标项目内非敏感的 staging 文件（`.iuse-staging/<name>.md`，
   allowedTools `Read,Glob,Grep,Write(<staging 相对路径>)`），校验通过后
   由 iuse 进程落位到最终路径并清理 staging。校验：无 `[ALL_CAPS]` 残留、
   CLAUDE.md <50 行。

6. **组合语义顺序无关**（沿组合 spec 红线）：同一 profile 的任何拼装顺序
   产出逐字节相同的目标状态；拼装是整篇拷贝，无合并、无模板参数化
   （AI 实例化只发生在 template 类，rule 一律原样）。

## Testing

- core 纯函数单测：resolveSource 解析链、drift 三态判定、下游账读写、
  拼装计划（profile → 文件清单）
- 集成：temp 中心源 fixture + temp 目标，init/status/update 全流程；
  claude 与 download 经 ctx 注入 fake；modified/outdated 场景各覆盖
- 真实冒烟：对本仓某 profile 在临时目录跑一次真 init（含真实例化）

## Error Handling

- 源缺 profiles.json / profile 名不存在：报错并列出可用 profile
- 源侧 composition 校验违规：拒绝 init，输出违规明细
- claude 实例化失败/超时：报错；已拷贝的 rules 保留有效，提示重跑
  `--force` 补实例化
- 远程拉取失败：报错并提示本地路径回退

## Non-Goals

- TUI；skill 分发（走 `pnpx skills add` 生态）；MCP 配置分发
- hooks 模板自动合并进 settings.json（手动装，文档注明）
- 下游修改自动回写中心（status 只提示人工处理）
- 多 profile 叠加、profile 继承（组合 spec 红线沿用）
- 订阅自动更新/watch（update 是显式动作）

## 后续处置

- iuse 落地后 `scripts/init-project.sh` 退役删除；ctx-init skill 改写为
  指向 iuse 的薄包装或退役（届时裁决）
- `imeta status` 不感知下游（下游对账职责在 iuse 侧，订阅关系活在下游账）
