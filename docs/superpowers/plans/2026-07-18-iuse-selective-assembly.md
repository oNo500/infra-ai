# iuse 目标级选择拼装 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 显式排除记入下游账（init 勾选/--exclude）、update 补回（勾选/--include）、逐条 diff 裁决（TUI o/i）、新命令 `iuse diff`。

**Architecture:** 排除态贯穿 core（lock.excluded → DriftState 'excluded' → status/update 语义）；diff 引擎独立 core 模块（jsdiff）供 CLI 命令与 TUI diff 视图共用；TUI 在既有 plan/update 视图上加勾选与裁决，执行仍走 plan/execute + onProgress。实现者动手前先读 `packages/iuse/src/{core,tui,cli}/` 全部相关文件。

**Tech Stack:** 既有栈 + `diff`（jsdiff，npm 包名 `diff`，dependencies）。

## Global Constraints

- spec：`docs/superpowers/specs/2026-07-18-iuse-selective-assembly-design.md`
- 忽略 = 本次跳过（继续提醒）；排除 = 永久闸门（不再提醒）；无「采纳本地为基线」第三态
- excluded 不计入 status/diff 的退出码漂移判定；裸跑 `iuse diff` 不含 excluded，指名时可查
- 旧账无 `excluded` 按空数组读；写回仅非空时带字段
- 排除/补回只动账与拷贝，不删本地文件
- 既有 90 测试全绿；子命令与 --json 既有形状不回退；禁 `!`/`@ts-ignore`/双重断言；kebab-case
- 每任务 `cd packages/iuse && bun test && bunx tsc --noEmit && bun run lint`
- commit 英文 Conventional Commits + trailer `Claude-Session: https://claude.ai/code/session_014qFwy6t5VhLF85toupsepd`

---

### Task 1: core 排除态（账、状态、init/update 语义）

**Files:**
- Modify: `packages/iuse/src/core/manifest.ts`、`src/core/report.ts`、`src/core/init.ts`、`src/core/update.ts`
- Test: `tests/manifest.test.ts`、`tests/report.test.ts`、`tests/init.test.ts`、`tests/update.test.ts`（追加）

**Interfaces（后续任务按此消费）:**
- `DownstreamLock` 增 `excluded?: string[]`；`saveDownstreamLock` 序列化时空数组/undefined 不写字段
- `DriftState` 增 `'excluded'`
- `runInit` opts 增 `exclude?: string[]`——校验每名必须在 profile.rules 内（否则 fail `unknown rules in --exclude: <x> (profile rules: <sorted list>)`）；排除项：不产 copy-rule step、不进 lock.rules、写入 lock.excluded（排序去重）；dry-run 的 steps 里以 `{ op: 'exclude-rule', target: <rule>, note: 'excluded' }` 呈现（预演可见）
- `statusReport`：lock.excluded 的每名输出 `{ rule, state: 'excluded' }` 行（与其他行合并按名排序）；excluded 不参与 exitCode 判定；源 profile 新增且不在 excluded → 照旧 outdated
- `runUpdate` opts 增 `include?: string[]`（校验每名必须在 lock.excluded 内，否则 fail `not excluded: <x> (currently excluded: <list or none>)`）与 `overwrite?: string[]`（TUI 裁决集：这些 modified 规则按源覆盖，等价于对单条的 force）：
  - include 干净路径（本地无文件或内容等于源）：拷贝 + 进 rules 基线 + 从 excluded 移除，step `{ op: 'include', target: <rule> }`
  - include 且本地已有不同内容：默认跳过 step `{ op: 'skip-include', target, note: "local differs, kept (see 'iuse diff <rule>', use --force to overwrite)" }`；`force` 或 rule ∈ overwrite → 覆盖（op 'include'，note '(overwrite)'），照常从 excluded 移除并入基线
  - excluded 且未被 include 的 rule：不产生任何 step（闸门语义）
  - overwrite 中的 modified 常规规则：op 'apply' note '(overwrite)'

- [ ] **Step 1: 写失败测试**（关键用例，按各文件既有 fixture 惯例展开）

```ts
// manifest：excluded 序列化往返 + 旧账无字段读为兼容（loadDownstreamLock 返回值上 excluded 可为 undefined，消费方 ?? []）
// init：--exclude 生效（文件未拷、rules 无、excluded 有、dry-run 现 exclude-rule step）；未知名报错含清单
// report：excluded 行 state 'excluded'；全 synced + 有 excluded → exitCode 0
// update：include 干净补回；本地不同默认 skip-include 提示 diff；force/包含于 overwrite 时覆盖；未 include 的 excluded 零 step；overwrite 单条覆盖 modified
```

- [ ] **Step 2: 确认失败** → **Step 3: 实现** → **Step 4: 全量验证（90 既有全绿）** → **Step 5: Commit** `feat(iuse): exclusion as first-class downstream state with re-include`

### Task 2: diff 引擎与 `iuse diff` 命令

**Files:**
- Modify: `packages/iuse/package.json`（dependencies 加 `"diff": "^8.0.0"`——以 npm 当前主版本为准照实填）
- Create: `packages/iuse/src/core/diff.ts`
- Modify: `packages/iuse/src/cli/index.ts`（新 `diff` 子命令）
- Test: `tests/diff.test.ts`

**Interfaces:**
- `interface RuleDiff { rule: string; state: DriftState; additions: number; deletions: number; patch?: string }`
- `diffReport(ctx: IuseContext, opts: { source?: string; target: string; rule?: string }): Promise<{ ok: boolean; message?: string; diffs: RuleDiff[]; exitCode: number }>`
  - 无 rule：遍历 lock.rules（不含 excluded），对 local ≠ source 的输出摘要（additions/deletions，无 patch）；全部一致 → diffs 空、exitCode 0；有差异 → exitCode 1
  - 指名 rule：可为普通或 excluded 项；输出含完整 `patch`（jsdiff `createTwoFilesPatch(rule+' (local)', rule+' (source)', localText, sourceText)`）；本地缺失按空串 diff 并 state 'missing'；行数统计用 `structuredPatch` hunks 累加
  - 未初始化目标 / 源解析失败：clean fail（沿 statusReport 形状）
- CLI `diff`：args source/json/target + 可选 positional `rule`（与 target 双 positional：rule 在前 target 在后？为避免歧义采用 `--rule <name>` 具名参数 + positional target，help 写明）；文本输出：摘要行 `<rule> +<a> -<d>`，指名时打印 patch 原文；`--json` `{ ok, diffs }` / 失败 `{ ok: false, message }`；退出码同 core。description（中文为主）：`对比下游副本与中心源的内容差异。--rule 查看单条完整 diff。有差异退 1，无差异退 0。`

- [ ] **Step 1: 写失败测试**（摘要模式含/不含差异与退出码；--rule patch 内容含 +/- 行；excluded 指名可查、裸跑不含；本地缺失全增；jsdiff 计数正确性用固定两段文本断言具体数字）
- [ ] **Step 2: 确认失败** → **Step 3: 实现（pnpm install 后提交含 lockfile）** → **Step 4: 全量验证** → **Step 5: Commit** `feat(iuse): diff command comparing downstream copies with the source`

### Task 3: CLI --exclude/--include 接线

**Files:**
- Modify: `packages/iuse/src/cli/index.ts`
- Test: `tests/cli.test.ts`（追加）

**Interfaces:**
- init 增 `exclude: { type: 'string', description: '排除的 rule 名（逗号分隔；记入下游账，之后 update --include 可补回）' }`——逗号切分去空 → runInit opts.exclude
- update 增 `include: { type: 'string', description: '补回此前排除的 rule 名（逗号分隔；本地有不同内容时默认跳过，--force 覆盖）' }` → runUpdate opts.include
- --json 形状不变（steps 已承载新 op 值）

- [ ] **Step 1: 失败测试**（切分传参断言——经 fixture 源真跑 runInit/runUpdate 验证 exclude/include 端到端；renderJson 不受影响）
- [ ] **Step 2-4: 实现与验证** → **Step 5: Commit** `feat(iuse): exclude and include flags`

### Task 4: TUI 勾选与逐条裁决

**Files:**
- Modify: `packages/iuse/src/tui/plan-view.tsx`（init 计划勾选）、`src/tui/update-plan-view.tsx`（导航/补回勾选/裁决集/执行）、`src/tui/status-view.tsx`（excluded 灰色行）、`src/tui/app.tsx`（exclude 集传递）
- Create: `packages/iuse/src/tui/diff-view.tsx`
- Test: `tests/tui-init-flow.test.tsx`、`tests/tui-status-flow.test.tsx`（追加）、必要时新 helper

**Interfaces（键位契约，写进各视图 hint 行）:**
- init plan-view：copy-rule 行前缀勾选框（`[x]`/`[ ]`）；`↑↓` 导航、`space` 切换（取消 = 排除）、`enter` 执行（带 exclude 集调 runInit）、`esc` 返回选择、`q` 退出；非 rule 行（settings/instantiate/write-lock）不可取消
- status-view：excluded 行 `<rule> excluded` 灰色（dimColor）；不影响既有键位
- update-plan-view：`↑↓` 导航；excluded 行以 `[ ] <rule> excluded` 出现，`space` 勾选为补回候选；modified 行与「补回且本地不同」行 `enter` 进 diff-view；`e` 执行（组装 opts：include=勾选集、overwrite=裁决为 o 的集合，其余默认）；`f` 仍整体切 force；`esc` 返回 status
- diff-view：渲染 `RuleDiff.patch`（`+` 行绿、`-` 行红、@@ 行青；超 200 行截断并提示 `iuse diff --rule <name>`）；`o` 裁决覆盖、`i` 裁决忽略（本次跳过）、`esc` 不裁决返回；裁决结果回写 update-plan-view 的 decisions 状态并在行尾显示 `[覆盖]`/`[忽略]`
- diff 数据经 `diffReport`（Task 2）取指名 rule 的 patch；TUI 一律走 deps.ctx

- [ ] **Step 1: 失败测试**（init 勾选后执行 → lock.excluded 断言 + 排除行文件未拷；status excluded 灰行文本存在；update 里 space 勾选补回 + enter 进 diff 视图（fake 差异文本）+ `o` 后行尾 `[覆盖]` + `e` 执行后 excluded 清、文件覆盖；`i` 路径保留本地）
- [ ] **Step 2: 确认失败** → **Step 3: 实现** → **Step 4: 全量验证** → **Step 5: Commit** `feat(iuse): selective assembly and per-rule diff adjudication in TUI`

### Task 5: 冒烟 + 文档 + 收尾（控制器 inline）

- [ ] **Step 1: 命令式冒烟**：临时目标 `init --exclude` → `status`（excluded 行、退出 0）→ `diff`（裸跑不含 excluded、`--rule` 指名可查）→ `update --include`（默认跳过提示 → `--force` 补回）全链路
- [ ] **Step 2: PTY 冒烟**：init 计划勾选帧 + update 清单帧截图留证
- [ ] **Step 3: 文档**：README 命令块加 `iuse diff` 行与 `--exclude/--include` 提点；旧 iuse spec 下游账节加一行指针到本 spec；ctx-init skill 元指令的命令语义段补 diff/exclude 一句并重建
- [ ] **Step 4: 全仓验证 + 台账 + memory**；final whole-branch review
- [ ] **Step 5: Commit** `feat(iuse): selective assembly smoke and docs`
