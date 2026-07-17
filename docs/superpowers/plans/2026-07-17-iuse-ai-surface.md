# iuse AI 友好面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iuse 获得 profiles 发现命令、init/update 的 --dry-run 预演、全命令 --json 与完善 help；ctx-init skill 改写为 iuse 指路。

**Architecture:** 「算计划/执行计划」两段式重构——runInit/runUpdate 先构造带类型的 step 列表再执行，dry-run 只走前段，--json 直接序列化同一结构；CLI 层统一 --json 双通道。实现全在 `packages/iuse`，实现者动手前先读 src/core/{init,update,report,assemble,manifest,source}.ts 与 src/cli/index.ts 现状。

**Tech Stack:** bun + TypeScript + citty；bun test。

## Global Constraints

- spec：`docs/superpowers/specs/2026-07-17-iuse-ai-surface-design.md`
- dry-run 与真实执行共享同一计划构造，预演零写入、不吞错（违规/源错误同样非零退出）
- --json 单行对象写 stdout，失败输出 `{ ok: false, message }`，退出码与文本模式一致；文本输出保持现状
- help 文本英文；退出码语义写进各命令 description
- 既有 48 个 iuse 测试必须保持全绿（重构行为不变）
- 禁 `!`/`@ts-ignore`/双重断言；kebab-case；每任务 `bun test && bunx tsc --noEmit && bun run lint`（packages/iuse）
- commit 英文 Conventional Commits + trailer `Claude-Session: https://claude.ai/code/session_014qFwy6t5VhLF85toupsepd`

---

### Task 1: 计划/执行两段式 + --dry-run

**Files:**
- Modify: `packages/iuse/src/core/init.ts`、`packages/iuse/src/core/update.ts`、`packages/iuse/src/cli/index.ts`（两命令加 dry-run flag）
- Test: `packages/iuse/tests/init.test.ts`、`packages/iuse/tests/update.test.ts`（追加）

**Interfaces:**
- Produces（后续任务 --json 直接消费）：
  - `export interface ActionStep { op: string; target: string; note?: string }`（放 init.ts 导出，update.ts 复用 import）
  - `runInit(ctx, opts)` 的 opts 增加 `dryRun?: boolean`；返回值变为 `{ ok: boolean; message: string; steps?: ActionStep[] }`——成功路径（含 dry-run）必带 steps；失败路径 steps 可省
  - init 的 op 取值：`copy-rule` | `copy-settings` | `instantiate` | `write-lock`；跳过用 note 说明（如 `skipped: already present`）
  - `runUpdate(ctx, opts)` 同样加 `dryRun?: boolean` 与 `steps?`；op 取值：`apply` | `skip-modified` | `skip-missing` | `add` | `drop` | `synced`
- 语义：
  - 计划构造阶段完成全部判定（lock 检查、violations、drift、skip 原因），执行阶段只按 steps 落盘/调 claude/写账
  - dryRun=true：构造后直接返回，message 为逐行 `<op> <target>`（含 note），不写任何文件、不调 claude；instantiate 步在 dry-run 里只列出「将实例化」，不预跑
  - dry-run 的 lock 检查照常（已初始化未加 --force 照样 fail）；violations 照常 fail
  - 真实执行路径的可观测输出与现状一致（既有测试断言不因重构而改）

- [ ] **Step 1: 写失败测试**（追加；风格沿用文件内既有 fixture/fake 惯例）

```ts
test('init --dry-run writes nothing and lists the full plan', async () => {
  const { source, target, ctx } = freshInitFixture() // 按文件内既有构造方式组装
  const result = await runInit(ctx, { source, profile: 'demo', target, force: false, dryRun: true })
  expect(result.ok).toBe(true)
  expect(existsSync(join(target, '.claude'))).toBe(false)
  const ops = (result.steps ?? []).map((s) => s.op)
  expect(ops).toContain('copy-rule')
  expect(ops).toContain('instantiate')
  expect(ops[ops.length - 1]).toBe('write-lock')
})

test('init --dry-run still fails on composition violations', async () => { /* 违规 fixture -> ok:false，目标零写入 */ })

test('update --dry-run reports per-rule decisions without applying', async () => {
  // 先真实 init，改源产物制造 outdated、改本地副本制造 modified
  // dry-run 后断言 steps 含 {op:'apply'} 与 {op:'skip-modified'}，且本地文件内容未变、lock 未变
})

test('real init still returns steps describing what happened', async () => { /* 非 dry-run 路径 steps 断言 */ })
```

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 重构实现**——init.ts：把 rules 循环/settings/模板/lock 四段改为先 push `ActionStep` 后统一执行；update.ts 同理（drift 判定循环产出 steps，执行段按 steps 应用）。CLI 两命令加 `dry-run` boolean flag 传入。
- [ ] **Step 4: 全量验证**（48 既有 + 新增全绿；tsc；lint）
- [ ] **Step 5: Commit** `feat(iuse): plan/execute split with --dry-run for init and update`

### Task 2: profiles 命令

**Files:**
- Create: `packages/iuse/src/core/profiles.ts`
- Modify: `packages/iuse/src/cli/index.ts`
- Test: `packages/iuse/tests/profiles.test.ts`

**Interfaces:**
- Produces: `listProfiles(sourceRoot: string): { name: string; description: string; rules: string[] }[]`（按 name 排序；description 缺省空串）；CLI `profiles` 子命令（`--source` 可选，源解析复用既有 resolveSource 接线；文本输出每 profile 一行 `<name>  <N> rules  <description>` 后跟缩进 rule 名逐行）

- [ ] **Step 1: 写失败测试**

```ts
import { listProfiles } from '../src/core/profiles'

test('lists profiles sorted with rules and descriptions', () => {
  const src = fixtureSource() // 两个 profile 的临时源，沿用 assemble.test.ts 的构造
  const rows = listProfiles(src)
  expect(rows.map((r) => r.name)).toEqual([...rows.map((r) => r.name)].toSorted())
  expect(rows[0]?.rules.length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: 确认失败** → **Step 3: 实现**（core 用 `loadProfiles`；CLI 仿 status 命令接线，源解析失败走 clean fail）→ **Step 4: 全量验证** → **Step 5: Commit** `feat(iuse): profiles discovery command`

### Task 3: 全命令 --json + help 完善

**Files:**
- Modify: `packages/iuse/src/cli/index.ts`
- Test: `packages/iuse/tests/cli.test.ts`（新建，直接调用导出的命令 run 逻辑或拆出的纯序列化函数）

**Interfaces:**
- Consumes: Task 1 的 steps、Task 2 的 listProfiles
- Produces：
  - 每个子命令 `--json` boolean。JSON 形状：status `{ ok, rows, exitCode }`（失败 `{ ok:false, message, exitCode:1 }`）；init/update `{ ok, message, steps }`；profiles `{ ok, profiles }`。单行 `JSON.stringify`，写 stdout；退出码与文本模式完全一致
  - 序列化拆成可测纯函数 `renderJson(result: unknown): string`（cli/index.ts 内导出即可）
  - help：main description 改为
    `Assemble Claude Code config from the infra-ai central source by profile. Typical flow: profiles -> init --dry-run -> init -> status/update.`；
    各命令 description 含何时用与退出码，逐字使用：
    - init: `Assemble a profile into a target project (rules + settings + AI-instantiated CLAUDE.md/architecture). Use --dry-run to preview. Exit 0 on success.`
    - status: `Report per-rule drift (synced/modified/outdated/missing) against the source. Exit 1 when anything needs attention, 0 when clean.`
    - update: `Apply source changes to an initialized target; locally modified copies are skipped unless --force. Use --dry-run to preview. Exit 0 on success.`
    - profiles: `List profiles available in the central source with their rules. Exit 0.`

- [ ] **Step 1: 写失败测试**（JSON 形状断言 + 文本模式不变断言 + 失败路径 `{ok:false,message}` 断言）
- [ ] **Step 2: 确认失败** → **Step 3: 实现** → **Step 4: 全量验证** → **Step 5: Commit** `feat(iuse): machine-readable --json output and self-describing help`

### Task 4: ctx-init 指路改写 + 冒烟 + 文档（控制器 inline）

**Files:**
- Modify: `meta/skills/ctx-init.md`（重写为 iuse 决策流：探测 which iuse → profiles 选型（拿不准问用户）→ init --dry-run 预演并复述 → init；无 iuse 降级手动流程）
- 重建：`imeta build ctx-init`
- Modify: `README.md`（命令块补 profiles 与 --dry-run 一行）
- 冒烟：真实目标跑 `iuse profiles`、`iuse init --dry-run --json`（断言零写入 + JSON 可解析）、随后真 init 一次确认无回归
- 台账 + memory 收尾
