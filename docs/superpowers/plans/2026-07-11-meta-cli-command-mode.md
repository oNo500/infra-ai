# meta-cli 命令式界面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 `docs/superpowers/specs/2026-07-11-meta-cli-command-mode-design.md`，为 meta-cli 增加 citty 子命令界面，功能同步由动作注册表 + parity 测试强制；附带把 giget 从 spawn 改为程序内调用。

**Architecture:** `src/core/actions.ts` 注册表收编全部动作（含从 `app.tsx` 下沉的编排逻辑），CLI 子命令由注册表生成，TUI 键位经 `keymap.ts` 声明并从注册表分发；`index.tsx` 按 argv 分流（无参 TUI / 有参 citty）。

**Tech Stack:** 既有栈（bun + pnpm + ink 6）+ citty（命令解析）+ giget（程序内下载）。

## Global Constraints

- 包管理 pnpm；运行与测试 bun（`bun test` 于 `packages/meta-cli/`）
- 源代码禁止 emoji；禁止 `@ts-ignore`；禁止双重断言；禁止 `!` 非空断言（用可选链）
- 文件名一律 kebab-case（含 React 组件文件）
- commit message 英文，Conventional Commits
- 每个任务提交前：`bun test` 全过 + `pnpm --filter @infra-ai/meta-cli typecheck` 干净 + `pnpm --filter @infra-ai/meta-cli lint` 干净
- 测试临时目录 `mkdtempSync(join(tmpdir(), 'meta-cli-'))`，测后 `rmSync` 清理
- 既有接口（本计划大量消费，签名以现有代码为准）：`runClaude(opts)`、`verifyBuild(repoRoot, asset)`、`recordBuild(repoRoot, asset, builtAt)`（内部已用 lockKey）、`gatherFacts(repoRoot, asset, lock)`、`computeStatus(facts)`、`lockKey(asset)`、`adoptEntry(m, a, t)`、`loadOverview(repoRoot)`、`discoverAssets(repoRoot)`、`loadTargets/saveTargets/loadLock/saveLock/loadSkills`、`subscribers(targets, name)`、`distribute(repoRoot, asset, target)`、`downstreamStates(repoRoot, asset, targets)`、`checkSkillsLedger/fixSkillsLedger/checkMirrors/updateMirror/officialRecommendations/listInstalledSkills`、`runCommand: CommandRunner`
- spec 裁决的退出码语义：`status` 在存在 dirty/stale/unbuilt 或下游 drift/missing 时退 1；**untracked 与 stub 不计入**（spec Decision 7 只列了 dirty/stale/drift/unbuilt；missing 视为待分发一并计入）
- TUI 交互流程不改（spec Non-Goal），只换底层调用

---

### Task 1: giget 程序化

**Files:**
- Modify: `packages/meta-cli/src/core/skills-sync.ts`（updateMirror）
- Modify: `packages/meta-cli/src/tui/skills-view.tsx`（调用点签名）
- Test: `packages/meta-cli/tests/skills-sync.test.ts`（重写 updateMirror 测试）

**Interfaces:**
- Consumes: 现有 `updateMirror(repoRoot, status, run, today)`（spawn `pnpx giget`）
- Produces: `type DownloadFn = (input: string, options?: { dir?: string; forceClean?: boolean }) => Promise<unknown>`；
  新签名 `updateMirror(repoRoot: string, status: MirrorStatus, today: string, download: DownloadFn = downloadTemplate): Promise<void>`（`run` 参数移除——它只被 giget spawn 用过）

行为变化（有意为之，记入 commit body）：原脚本 `giget --force` 在既有目录上覆盖提取，上游删掉的文件会残留；
改为 `forceClean: true` 先清目录再提取，镜像语义更正确。

- [ ] **Step 1: 改写测试**

`packages/meta-cli/tests/skills-sync.test.ts` 中现有 `describe('updateMirror', ...)` 整块替换为：

```ts
describe('updateMirror', () => {
  test('downloads via giget and rewrites ledger entry', async () => {
    const root = repoWith({}, [
      { name: 'drawio', source: 'mirror', repo: 'r/x', path: 'p', commit: 'old', updated: '2026-07-04' },
    ])
    const calls: [string, { dir?: string; forceClean?: boolean } | undefined][] = []
    const download: DownloadFn = async (input, options) => {
      calls.push([input, options])
      return {}
    }
    try {
      await updateMirror(
        root,
        { name: 'drawio', localCommit: 'old', remoteCommit: 'new', outdated: true },
        '2026-07-11',
        download,
      )
      expect(calls[0]?.[0]).toBe('gh:r/x/p')
      expect(calls[0]?.[1]?.dir).toBe(join(root, 'skills', 'drawio'))
      expect(calls[0]?.[1]?.forceClean).toBe(true)
      const ledger = JSON.parse(readFileSync(join(root, 'skills.json'), 'utf8')) as SkillEntry[]
      expect(ledger[0]?.commit).toBe('new')
      expect(ledger[0]?.updated).toBe('2026-07-11')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('rejects non-mirror skills', async () => {
    const root = repoWith({}, [{ name: 'x', source: 'custom' }])
    const download: DownloadFn = async () => ({})
    try {
      await expect(
        updateMirror(root, { name: 'x', localCommit: '', remoteCommit: 'n', outdated: true }, '2026-07-11', download),
      ).rejects.toThrow(/not a mirror/u)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
```

import 行同步：从 `../src/core/skills-sync` 增加导入 `type DownloadFn`；`CommandRunner` 若仅剩 checkMirrors 用则保留。

- [ ] **Step 2: 跑测试确认失败**

```bash
cd packages/meta-cli && bun test tests/skills-sync.test.ts
```

期望：FAIL（DownloadFn 不存在、参数不匹配）。

- [ ] **Step 3: 实现**

```bash
pnpm --filter @infra-ai/meta-cli add giget
```

`packages/meta-cli/src/core/skills-sync.ts`：顶部加 `import { downloadTemplate } from 'giget'`，
`updateMirror` 整体替换为：

```ts
export type DownloadFn = (
  input: string,
  options?: { dir?: string; forceClean?: boolean },
) => Promise<unknown>

export async function updateMirror(
  repoRoot: string,
  status: MirrorStatus,
  today: string,
  download: DownloadFn = downloadTemplate,
): Promise<void> {
  const ledger = loadSkills(repoRoot)
  const entry = ledger.find((s) => s.name === status.name)
  if (!entry || entry.source !== 'mirror') throw new Error(`not a mirror skill: ${status.name}`)
  await download(`gh:${entry.repo}/${entry.path}`, {
    dir: join(repoRoot, 'skills', entry.name),
    forceClean: true,
  })
  saveSkills(
    repoRoot,
    ledger.map((s) =>
      s.name === status.name ? Object.assign({}, s, { commit: status.remoteCommit, updated: today }) : s,
    ),
  )
}
```

`packages/meta-cli/src/tui/skills-view.tsx`：`u` 处理器中
`updateMirror(repoRoot, m, runCommand, today)` 改为 `updateMirror(repoRoot, m, today)`；
若 `runCommand` 仅剩 checkMirrors/listInstalledSkills 使用则 import 保留。

- [ ] **Step 4: 验证并提交**

```bash
bun test && pnpm --filter @infra-ai/meta-cli typecheck && pnpm --filter @infra-ai/meta-cli lint
git add packages/meta-cli pnpm-lock.yaml
git commit -m "refactor(meta-cli): call giget programmatically in updateMirror

Replaces the pnpx giget spawn. forceClean replaces --force so files
deleted upstream no longer linger in the mirror directory."
```

---

### Task 2: 注册表类型与 query 动作

**Files:**
- Create: `packages/meta-cli/src/core/actions.ts`
- Test: `packages/meta-cli/tests/actions.test.ts`

**Interfaces:**
- Consumes: Global Constraints 列出的全部 core 接口 + Task 1 的 `DownloadFn`
- Produces（后续任务依赖的确切形状）:

```ts
export interface ActionContext { repoRoot: string; run: CommandRunner; now: () => string; claude: typeof runClaude; download: DownloadFn }
export function defaultContext(repoRoot: string): ActionContext
export interface ActionHooks { onText?: (t: string) => void }
export interface ArgSpec { name: string; kind: 'positional' | 'flag'; required?: boolean; variadic?: boolean; description: string }
export interface ActionParams { positionals: string[]; flags: Record<string, boolean> }
export interface ActionResult { ok: boolean; message?: string; data?: unknown; exitCode?: number }
export interface ActionDef { id: string; summary: string; kind: 'query' | 'mutation'; args: ArgSpec[]; execute(ctx: ActionContext, params: ActionParams, hooks?: ActionHooks): Promise<ActionResult> }
export const ACTIONS: ActionDef[]
export function getAction(id: string): ActionDef
export interface StatusRowData { name: string; kind: string; status: string; scope: string | null; metaPath: string; artifactPath: string; downstream: { synced: number; drift: number; missing: number }; targets: { path: string; state: string }[] }
export interface SkillsStatusData { issues: LedgerIssue[]; mirrors: MirrorStatus[]; installed: string[]; recommendations: Recommendation[] }
```

本任务实现 query 三件：`status`、`targets:list`、`skills:status`。

- [ ] **Step 1: 写失败测试**

`packages/meta-cli/tests/actions.test.ts`：

```ts
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getAction, type ActionContext, type StatusRowData } from '../src/core/actions'
import { sha256 } from '../src/core/io'

export function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
  writeFileSync(join(root, 'skills.json'), '[]\n')
  mkdirSync(join(root, 'meta/rules'), { recursive: true })
  writeFileSync(
    join(root, 'meta/rules/foo.md'),
    '---\nname: foo\ntarget: rule\nstatus: ready\nscope: global\n---\nbody\n',
  )
  return root
}

export function testContext(root: string, overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    repoRoot: root,
    run: async () => ({ code: 0, stdout: '', stderr: '' }),
    now: () => '2026-07-11T00:00:00.000Z',
    claude: async () => ({ code: 0, timedOut: false, stderr: '' }),
    download: async () => ({}),
    ...overrides,
  }
}

function syncLock(root: string): void {
  const meta = '---\nname: foo\ntarget: rule\nstatus: ready\nscope: global\n---\nbody\n'
  const artifact = '# foo\n'
  mkdirSync(join(root, 'rules/global'), { recursive: true })
  writeFileSync(join(root, 'rules/global/foo.md'), artifact)
  writeFileSync(
    join(root, 'artifacts.lock.json'),
    `${JSON.stringify({ 'rule:foo': { metaHash: sha256(meta), artifactHash: sha256(artifact), builtAt: '2026-07-11T00:00:00.000Z' } })}\n`,
  )
}

describe('status action', () => {
  test('unbuilt asset yields exitCode 1 with row data', async () => {
    const root = fixtureRepo()
    try {
      const result = await getAction('status').execute(testContext(root), { positionals: [], flags: {} })
      expect(result.ok).toBe(true)
      expect(result.exitCode).toBe(1)
      const rows = result.data as StatusRowData[]
      expect(rows[0]?.name).toBe('foo')
      expect(rows[0]?.status).toBe('unbuilt')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('all synced yields exitCode 0; named lookup filters; unknown name fails', async () => {
    const root = fixtureRepo()
    try {
      syncLock(root)
      const all = await getAction('status').execute(testContext(root), { positionals: [], flags: {} })
      expect(all.exitCode).toBe(0)
      const one = await getAction('status').execute(testContext(root), { positionals: ['foo'], flags: {} })
      expect((one.data as StatusRowData[]).length).toBe(1)
      const missing = await getAction('status').execute(testContext(root), { positionals: ['nope'], flags: {} })
      expect(missing.ok).toBe(false)
      expect(missing.exitCode).toBe(1)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('targets:list action', () => {
  test('returns targets registry data', async () => {
    const root = fixtureRepo()
    try {
      writeFileSync(join(root, 'targets.json'), `${JSON.stringify([{ path: '/tmp/a', subscriptions: ['foo'] }])}\n`)
      const result = await getAction('targets:list').execute(testContext(root), { positionals: [], flags: {} })
      expect(result.ok).toBe(true)
      expect(result.data).toEqual([{ path: '/tmp/a', subscriptions: ['foo'] }])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('skills:status action', () => {
  test('aggregates ledger, mirrors, installed, recommendations', async () => {
    const root = fixtureRepo()
    try {
      writeFileSync(
        join(root, 'skills.json'),
        `${JSON.stringify([
          { name: 'm', source: 'mirror', repo: 'r/x', path: 'p', commit: 'old' },
          { name: 'o', source: 'official', repo: 'own/rep' },
        ])}\n`,
      )
      const run: ActionContext['run'] = async (cmd) =>
        cmd === 'gh' ? { code: 0, stdout: 'new\n', stderr: '' } : { code: 0, stdout: 'skill-a\nskill-b\n', stderr: '' }
      const result = await getAction('skills:status').execute(testContext(root, { run }), { positionals: [], flags: {} })
      expect(result.exitCode).toBe(1)
      const data = result.data as { mirrors: { outdated: boolean }[]; installed: string[]; recommendations: { name: string }[] }
      expect(data.mirrors[0]?.outdated).toBe(true)
      expect(data.installed).toEqual(['skill-a', 'skill-b'])
      expect(data.recommendations[0]?.name).toBe('o')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
bun test tests/actions.test.ts
```

期望：FAIL（模块不存在）。

- [ ] **Step 3: 实现（类型 + 三个 query 动作）**

`packages/meta-cli/src/core/actions.ts`：

```ts
import { downloadTemplate } from 'giget'
import {
  allowedToolsFor,
  buildPromptFor,
  recordBuild,
  runClaude,
  verifyBuild,
  writebackPromptFor,
} from './claude'
import { distribute, downstreamStates, subscribers } from './dist'
import { runCommand } from './io'
import type { CommandRunner } from './io'
import { discoverAssets } from './meta'
import type { MetaAsset } from './meta'
import { loadOverview } from './overview'
import { loadLock, loadSkills, loadTargets, saveLock, saveTargets } from './registry'
import {
  checkMirrors,
  checkSkillsLedger,
  fixSkillsLedger,
  listInstalledSkills,
  officialRecommendations,
  updateMirror,
} from './skills-sync'
import type { DownloadFn, LedgerIssue, MirrorStatus, Recommendation } from './skills-sync'
import { adoptEntry, computeStatus, gatherFacts, lockKey } from './status'

export interface ActionContext {
  repoRoot: string
  run: CommandRunner
  now: () => string
  claude: typeof runClaude
  download: DownloadFn
}

export function defaultContext(repoRoot: string): ActionContext {
  return {
    repoRoot,
    run: runCommand,
    now: () => new Date().toISOString(),
    claude: runClaude,
    download: downloadTemplate,
  }
}

export interface ActionHooks {
  onText?: (t: string) => void
}

export interface ArgSpec {
  name: string
  kind: 'positional' | 'flag'
  required?: boolean
  variadic?: boolean
  description: string
}

export interface ActionParams {
  positionals: string[]
  flags: Record<string, boolean>
}

export interface ActionResult {
  ok: boolean
  message?: string
  data?: unknown
  exitCode?: number
}

export interface ActionDef {
  id: string
  summary: string
  kind: 'query' | 'mutation'
  args: ArgSpec[]
  execute(ctx: ActionContext, params: ActionParams, hooks?: ActionHooks): Promise<ActionResult>
}

export interface StatusRowData {
  name: string
  kind: string
  status: string
  scope: string | null
  metaPath: string
  artifactPath: string
  downstream: { synced: number; drift: number; missing: number }
  targets: { path: string; state: string }[]
}

export interface SkillsStatusData {
  issues: LedgerIssue[]
  mirrors: MirrorStatus[]
  installed: string[]
  recommendations: Recommendation[]
}

function fail(message: string): ActionResult {
  return { ok: false, message, exitCode: 1 }
}

function findAsset(repoRoot: string, name: string): MetaAsset | null {
  return discoverAssets(repoRoot).find((a) => a.name === name) ?? null
}

// spec Decision 7: dirty/stale/unbuilt 或下游 drift/missing 计入待收敛；untracked 与 stub 不计
const PENDING_STATUSES = new Set(['dirty', 'stale', 'unbuilt'])

const statusAction: ActionDef = {
  id: 'status',
  summary: 'Show reconcile status for all assets or one asset',
  kind: 'query',
  args: [{ name: 'name', kind: 'positional', description: 'asset name (optional)' }],
  async execute(ctx, params) {
    const rows = loadOverview(ctx.repoRoot)
    const targets = loadTargets(ctx.repoRoot)
    const name = params.positionals[0]
    const selected = name ? rows.filter((r) => r.asset.name === name) : rows
    if (name && selected.length === 0) return fail(`unknown asset: ${name}`)
    const data: StatusRowData[] = selected.map((r) => ({
      name: r.asset.name,
      kind: r.asset.kind,
      status: r.status,
      scope: r.asset.scope,
      metaPath: r.asset.metaPath,
      artifactPath: r.asset.artifactPath,
      downstream: r.downstream,
      targets:
        r.asset.kind === 'rule'
          ? downstreamStates(ctx.repoRoot, r.asset, targets).map((s) => ({ path: s.target.path, state: s.state }))
          : [],
    }))
    const pending = data.some(
      (d) => PENDING_STATUSES.has(d.status) || d.downstream.drift + d.downstream.missing > 0,
    )
    return { ok: true, data, exitCode: pending ? 1 : 0 }
  },
}

const targetsListAction: ActionDef = {
  id: 'targets:list',
  summary: 'List distribution targets and their subscriptions',
  kind: 'query',
  args: [],
  async execute(ctx) {
    return { ok: true, data: loadTargets(ctx.repoRoot), exitCode: 0 }
  },
}

const skillsStatusAction: ActionDef = {
  id: 'skills:status',
  summary: 'Show skills ledger issues, mirror freshness, installed and recommended skills',
  kind: 'query',
  args: [],
  async execute(ctx) {
    const skills = loadSkills(ctx.repoRoot)
    const issues = checkSkillsLedger(ctx.repoRoot)
    const [mirrors, installed] = await Promise.all([
      checkMirrors(skills, ctx.run),
      listInstalledSkills(ctx.run),
    ])
    const data: SkillsStatusData = {
      issues,
      mirrors,
      installed,
      recommendations: officialRecommendations(skills),
    }
    const pending = issues.length > 0 || mirrors.some((m) => m.outdated)
    return { ok: true, data, exitCode: pending ? 1 : 0 }
  },
}

export const ACTIONS: ActionDef[] = [statusAction, targetsListAction, skillsStatusAction]

export function getAction(id: string): ActionDef {
  const action = ACTIONS.find((a) => a.id === id)
  if (!action) throw new Error(`unknown action: ${id}`)
  return action
}
```

（`fail`、`findAsset`、mutation 相关 import 在本任务已就位，Task 3/4 直接使用；
oxlint 若报未使用 import，临时以本任务实际使用为准删减，Task 3/4 再补回。）

- [ ] **Step 4: 验证并提交**

```bash
bun test tests/actions.test.ts && bun test
pnpm --filter @infra-ai/meta-cli typecheck && pnpm --filter @infra-ai/meta-cli lint
git add packages/meta-cli/src/core/actions.ts packages/meta-cli/tests/actions.test.ts
git commit -m "feat(meta-cli): add action registry with query actions"
```

---

### Task 3: 资产 mutation 动作（adopt / build / writeback / dist）

**Files:**
- Modify: `packages/meta-cli/src/core/actions.ts`
- Test: `packages/meta-cli/tests/actions.test.ts`（追加）

**Interfaces:**
- Consumes: Task 2 的类型与 helpers（`fail`、`findAsset`、`PENDING_STATUSES` 不变）；
  测试复用 Task 2 导出的 `fixtureRepo`、`testContext`、`syncLock` 模式
- Produces: `ACTIONS` 追加 id `adopt`、`build`、`writeback`、`dist`（形状同 ActionDef）

- [ ] **Step 1: 追加失败测试**

`packages/meta-cli/tests/actions.test.ts` 追加（`writeFileSync`/`readFileSync` 已在 import；
如缺 `readFileSync` 补上）：

```ts
describe('adopt action', () => {
  test('records lock baseline for untracked asset; rejects non-untracked', async () => {
    const root = fixtureRepo()
    try {
      mkdirSync(join(root, 'rules/global'), { recursive: true })
      writeFileSync(join(root, 'rules/global/foo.md'), '# foo\n')
      const ok = await getAction('adopt').execute(testContext(root), { positionals: ['foo'], flags: {} })
      expect(ok.ok).toBe(true)
      const lock = JSON.parse(readFileSync(join(root, 'artifacts.lock.json'), 'utf8')) as Record<string, unknown>
      expect(lock['rule:foo']).toBeDefined()
      const again = await getAction('adopt').execute(testContext(root), { positionals: ['foo'], flags: {} })
      expect(again.ok).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('build action', () => {
  test('claude success path verifies artifact and records lock', async () => {
    const root = fixtureRepo()
    try {
      const claude: ActionContext['claude'] = async (opts) => {
        mkdirSync(join(root, 'rules/global'), { recursive: true })
        writeFileSync(join(root, 'rules/global/foo.md'), '# built\n')
        opts.onText?.('building')
        return { code: 0, timedOut: false, stderr: '' }
      }
      const texts: string[] = []
      const result = await getAction('build').execute(
        testContext(root, { claude }),
        { positionals: ['foo'], flags: {} },
        { onText: (t) => texts.push(t) },
      )
      expect(result.ok).toBe(true)
      const lock = JSON.parse(readFileSync(join(root, 'artifacts.lock.json'), 'utf8')) as Record<string, unknown>
      expect(lock['rule:foo']).toBeDefined()
      expect(texts).toContain('building')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('claude failure leaves lock untouched; stub and unknown assets rejected', async () => {
    const root = fixtureRepo()
    try {
      writeFileSync(join(root, 'meta/rules/bar.md'), '---\nname: bar\ntarget: rule\nstatus: stub\n---\n')
      const claude: ActionContext['claude'] = async () => ({ code: 1, timedOut: false, stderr: 'boom' })
      const failRes = await getAction('build').execute(testContext(root, { claude }), { positionals: ['foo'], flags: {} })
      expect(failRes.ok).toBe(false)
      expect(existsSync(join(root, 'artifacts.lock.json'))).toBe(false)
      const stub = await getAction('build').execute(testContext(root), { positionals: ['bar'], flags: {} })
      expect(stub.ok).toBe(false)
      expect(stub.message).toMatch(/stub/u)
      const unknown = await getAction('build').execute(testContext(root), { positionals: ['nope'], flags: {} })
      expect(unknown.ok).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('--stale with nothing stale is a no-op success', async () => {
    const root = fixtureRepo()
    try {
      const result = await getAction('build').execute(testContext(root), { positionals: [], flags: { stale: true } })
      expect(result.ok).toBe(true)
      expect(result.message).toBe('no stale assets')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('writeback action', () => {
  test('requires dirty status', async () => {
    const root = fixtureRepo()
    try {
      syncLock(root)
      const notDirty = await getAction('writeback').execute(testContext(root), { positionals: ['foo'], flags: {} })
      expect(notDirty.ok).toBe(false)
      expect(notDirty.message).toMatch(/not dirty/u)
      writeFileSync(join(root, 'rules/global/foo.md'), '# edited\n')
      const claude: ActionContext['claude'] = async () => ({ code: 0, timedOut: false, stderr: '' })
      const dirty = await getAction('writeback').execute(testContext(root, { claude }), { positionals: ['foo'], flags: {} })
      expect(dirty.ok).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('dist action', () => {
  test('copies to subscribers; rejects no-subscriber and non-rule; --all skips synced', async () => {
    const root = fixtureRepo()
    const downstream = mkdtempSync(join(tmpdir(), 'meta-cli-target-'))
    try {
      syncLock(root)
      const none = await getAction('dist').execute(testContext(root), { positionals: ['foo'], flags: {} })
      expect(none.ok).toBe(false)
      expect(none.message).toMatch(/no subscribers/u)
      writeFileSync(
        join(root, 'targets.json'),
        `${JSON.stringify([{ path: downstream, subscriptions: ['foo'] }])}\n`,
      )
      const one = await getAction('dist').execute(testContext(root), { positionals: ['foo'], flags: {} })
      expect(one.ok).toBe(true)
      expect(readFileSync(join(downstream, '.claude/rules/foo.md'), 'utf8')).toBe('# foo\n')
      const allSynced = await getAction('dist').execute(testContext(root), { positionals: [], flags: { all: true } })
      expect(allSynced.ok).toBe(true)
      expect(allSynced.message).toBe('nothing to distribute')
    } finally {
      rmSync(root, { recursive: true, force: true })
      rmSync(downstream, { recursive: true, force: true })
    }
  })
})
```

（`existsSync` 需加入 node:fs import。）

- [ ] **Step 2: 跑测试确认失败**

```bash
bun test tests/actions.test.ts
```

期望：新增 describe 全部 FAIL（unknown action）。

- [ ] **Step 3: 实现四个 mutation**

`packages/meta-cli/src/core/actions.ts` 在 query 动作之后追加，并把四个动作加进 `ACTIONS` 数组
（顺序：`status, adopt, build, writeback, dist, targets:list, skills:status`）：

```ts
const adoptAction: ActionDef = {
  id: 'adopt',
  summary: 'Record current meta/artifact hashes as the lock baseline for an untracked asset',
  kind: 'mutation',
  args: [{ name: 'name', kind: 'positional', required: true, description: 'asset name' }],
  async execute(ctx, params) {
    const name = params.positionals[0]
    if (!name) return fail('asset name required')
    const asset = findAsset(ctx.repoRoot, name)
    if (!asset) return fail(`unknown asset: ${name}`)
    const lock = loadLock(ctx.repoRoot)
    const facts = gatherFacts(ctx.repoRoot, asset, lock)
    const status = computeStatus(facts)
    if (status !== 'untracked') return fail(`${name} is not untracked (status: ${status})`)
    if (facts.artifactHash === null) return fail(`artifact missing: ${asset.artifactPath}`)
    saveLock(ctx.repoRoot, {
      ...lock,
      [lockKey(asset)]: adoptEntry(facts.metaHash, facts.artifactHash, ctx.now()),
    })
    return { ok: true, message: `adopted ${name}` }
  },
}

async function buildOne(ctx: ActionContext, asset: MetaAsset, hooks?: ActionHooks): Promise<string | null> {
  const res = await ctx.claude({
    repoRoot: ctx.repoRoot,
    prompt: buildPromptFor(asset),
    allowedTools: allowedToolsFor(asset, 'build'),
    onText: hooks?.onText,
  })
  if (res.timedOut) return 'claude timed out'
  if (res.code !== 0) return `claude exited ${res.code}: ${res.stderr.slice(-500)}`
  const err = verifyBuild(ctx.repoRoot, asset)
  if (err) return err
  recordBuild(ctx.repoRoot, asset, ctx.now())
  return null
}

const buildAction: ActionDef = {
  id: 'build',
  summary: 'Build artifacts from meta instructions via claude headless',
  kind: 'mutation',
  args: [
    { name: 'name', kind: 'positional', variadic: true, description: 'asset names' },
    { name: 'stale', kind: 'flag', description: 'build all stale assets' },
  ],
  async execute(ctx, params, hooks) {
    let assets: MetaAsset[]
    if (params.flags.stale) {
      assets = loadOverview(ctx.repoRoot)
        .filter((r) => r.status === 'stale')
        .map((r) => r.asset)
      if (assets.length === 0) return { ok: true, message: 'no stale assets' }
    } else {
      if (params.positionals.length === 0) return fail('asset name required (or --stale)')
      const resolved: MetaAsset[] = []
      for (const name of params.positionals) {
        const asset = findAsset(ctx.repoRoot, name)
        if (!asset) return fail(`unknown asset: ${name}`)
        if (asset.status === 'stub') return fail(`${name} is stub: complete the meta instruction first`)
        resolved.push(asset)
      }
      assets = resolved
    }
    const built: string[] = []
    for (const asset of assets) {
      hooks?.onText?.(`--- ${asset.name} ---`)
      const err = await buildOne(ctx, asset, hooks)
      if (err) return fail(`${asset.name}: ${err}`)
      built.push(asset.name)
    }
    return { ok: true, message: `built ${built.join(', ')}` }
  },
}

const writebackAction: ActionDef = {
  id: 'writeback',
  summary: 'Write valuable direct artifact edits back into the meta instruction via claude headless',
  kind: 'mutation',
  args: [{ name: 'name', kind: 'positional', required: true, description: 'asset name' }],
  async execute(ctx, params, hooks) {
    const name = params.positionals[0]
    if (!name) return fail('asset name required')
    const asset = findAsset(ctx.repoRoot, name)
    if (!asset) return fail(`unknown asset: ${name}`)
    const status = computeStatus(gatherFacts(ctx.repoRoot, asset, loadLock(ctx.repoRoot)))
    if (status !== 'dirty') return fail(`${name} is not dirty (status: ${status})`)
    const res = await ctx.claude({
      repoRoot: ctx.repoRoot,
      prompt: writebackPromptFor(asset),
      allowedTools: allowedToolsFor(asset, 'writeback'),
      onText: hooks?.onText,
    })
    if (res.timedOut) return fail('claude timed out')
    if (res.code !== 0) return fail(`claude exited ${res.code}: ${res.stderr.slice(-500)}`)
    return { ok: true, message: `wrote back ${name}; meta changed, asset is now stale` }
  },
}

const distAction: ActionDef = {
  id: 'dist',
  summary: 'Copy rule artifacts to subscribed downstream projects',
  kind: 'mutation',
  args: [
    { name: 'name', kind: 'positional', variadic: true, description: 'rule asset names' },
    { name: 'all', kind: 'flag', description: 'distribute all rules with drift or missing downstream copies' },
  ],
  async execute(ctx, params, hooks) {
    const targets = loadTargets(ctx.repoRoot)
    const copied: string[] = []
    if (params.flags.all) {
      const pending = loadOverview(ctx.repoRoot).filter(
        (r) => r.asset.kind === 'rule' && r.downstream.drift + r.downstream.missing > 0,
      )
      for (const r of pending) {
        for (const { target, state } of downstreamStates(ctx.repoRoot, r.asset, targets)) {
          if (state === 'synced') continue
          distribute(ctx.repoRoot, r.asset, target)
          hooks?.onText?.(`${r.asset.name} -> ${target.path}`)
          copied.push(target.path)
        }
      }
      return {
        ok: true,
        message: copied.length > 0 ? `distributed ${copied.length} copies` : 'nothing to distribute',
      }
    }
    if (params.positionals.length === 0) return fail('asset name required (or --all)')
    for (const name of params.positionals) {
      const asset = findAsset(ctx.repoRoot, name)
      if (!asset) return fail(`unknown asset: ${name}`)
      if (asset.kind !== 'rule') return fail(`${name} is not a rule (only rules are distributable)`)
      const subs = subscribers(targets, name)
      if (subs.length === 0) return fail(`${name} has no subscribers (register via: meta targets subscribe <path> ${name})`)
      for (const target of subs) {
        distribute(ctx.repoRoot, asset, target)
        hooks?.onText?.(`${name} -> ${target.path}`)
        copied.push(target.path)
      }
    }
    return { ok: true, message: `distributed ${copied.length} copies` }
  },
}
```

- [ ] **Step 4: 验证并提交**

```bash
bun test && pnpm --filter @infra-ai/meta-cli typecheck && pnpm --filter @infra-ai/meta-cli lint
git add packages/meta-cli/src/core/actions.ts packages/meta-cli/tests/actions.test.ts
git commit -m "feat(meta-cli): add asset mutation actions to registry"
```

---

### Task 4: targets / skills mutation 动作

**Files:**
- Modify: `packages/meta-cli/src/core/actions.ts`
- Test: `packages/meta-cli/tests/actions.test.ts`（追加）

**Interfaces:**
- Consumes: Task 2/3 全部；Task 1 的 `updateMirror(repoRoot, status, today, download)`
- Produces: `ACTIONS` 追加 `targets:add`、`targets:remove`、`targets:subscribe`、`targets:unsubscribe`、`skills:fix`、`skills:update`；最终 `ACTIONS` 共 13 个，顺序：
  `status, adopt, build, writeback, dist, targets:list, targets:add, targets:remove, targets:subscribe, targets:unsubscribe, skills:status, skills:fix, skills:update`

- [ ] **Step 1: 追加失败测试**

```ts
describe('targets mutations', () => {
  test('add validates absolute path and rejects duplicates; remove validates existence', async () => {
    const root = fixtureRepo()
    try {
      const rel = await getAction('targets:add').execute(testContext(root), { positionals: ['x/y'], flags: {} })
      expect(rel.ok).toBe(false)
      const add = await getAction('targets:add').execute(testContext(root), { positionals: ['/tmp/a'], flags: {} })
      expect(add.ok).toBe(true)
      const dup = await getAction('targets:add').execute(testContext(root), { positionals: ['/tmp/a'], flags: {} })
      expect(dup.ok).toBe(false)
      const gone = await getAction('targets:remove').execute(testContext(root), { positionals: ['/tmp/b'], flags: {} })
      expect(gone.ok).toBe(false)
      const rm = await getAction('targets:remove').execute(testContext(root), { positionals: ['/tmp/a'], flags: {} })
      expect(rm.ok).toBe(true)
      expect(JSON.parse(readFileSync(join(root, 'targets.json'), 'utf8'))).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('subscribe requires built rule and no duplicates; unsubscribe requires existing', async () => {
    const root = fixtureRepo()
    try {
      await getAction('targets:add').execute(testContext(root), { positionals: ['/tmp/a'], flags: {} })
      const unbuilt = await getAction('targets:subscribe').execute(testContext(root), { positionals: ['/tmp/a', 'foo'], flags: {} })
      expect(unbuilt.ok).toBe(false)
      syncLock(root)
      const sub = await getAction('targets:subscribe').execute(testContext(root), { positionals: ['/tmp/a', 'foo'], flags: {} })
      expect(sub.ok).toBe(true)
      const dup = await getAction('targets:subscribe').execute(testContext(root), { positionals: ['/tmp/a', 'foo'], flags: {} })
      expect(dup.ok).toBe(false)
      const un = await getAction('targets:unsubscribe').execute(testContext(root), { positionals: ['/tmp/a', 'foo'], flags: {} })
      expect(un.ok).toBe(true)
      const missing = await getAction('targets:unsubscribe').execute(testContext(root), { positionals: ['/tmp/a', 'foo'], flags: {} })
      expect(missing.ok).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('skills mutations', () => {
  test('skills:fix adds unledgered dirs and reports remaining issues', async () => {
    const root = fixtureRepo()
    try {
      mkdirSync(join(root, 'skills/extra'), { recursive: true })
      writeFileSync(join(root, 'skills/extra/SKILL.md'), '---\nname: extra\n---\n')
      const result = await getAction('skills:fix').execute(testContext(root), { positionals: [], flags: {} })
      expect(result.ok).toBe(true)
      expect(result.message).toContain('extra')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('skills:update updates only outdated mirrors via injected download', async () => {
    const root = fixtureRepo()
    try {
      writeFileSync(
        join(root, 'skills.json'),
        `${JSON.stringify([{ name: 'm', source: 'mirror', repo: 'r/x', path: 'p', commit: 'old' }])}\n`,
      )
      const downloads: string[] = []
      const run: ActionContext['run'] = async () => ({ code: 0, stdout: 'new\n', stderr: '' })
      const download: ActionContext['download'] = async (input) => {
        downloads.push(input)
        return {}
      }
      const result = await getAction('skills:update').execute(
        testContext(root, { run, download }),
        { positionals: [], flags: {} },
      )
      expect(result.ok).toBe(true)
      expect(downloads).toEqual(['gh:r/x/p'])
      const ledger = JSON.parse(readFileSync(join(root, 'skills.json'), 'utf8')) as { commit: string }[]
      expect(ledger[0]?.commit).toBe('new')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
bun test tests/actions.test.ts
```

期望：新增 describe FAIL（unknown action）。

- [ ] **Step 3: 实现六个动作**

`packages/meta-cli/src/core/actions.ts` 追加（并按 Produces 顺序重排 `ACTIONS`）：

```ts
const targetsAddAction: ActionDef = {
  id: 'targets:add',
  summary: 'Register a downstream project path',
  kind: 'mutation',
  args: [{ name: 'path', kind: 'positional', required: true, description: 'absolute path of downstream project' }],
  async execute(ctx, params) {
    const path = params.positionals[0]
    if (!path) return fail('path required')
    if (!path.startsWith('/')) return fail('path must be absolute')
    const targets = loadTargets(ctx.repoRoot)
    if (targets.some((t) => t.path === path)) return fail(`target already registered: ${path}`)
    saveTargets(ctx.repoRoot, [...targets, { path, subscriptions: [] }])
    return { ok: true, message: `added target ${path}` }
  },
}

const targetsRemoveAction: ActionDef = {
  id: 'targets:remove',
  summary: 'Unregister a downstream project path',
  kind: 'mutation',
  args: [{ name: 'path', kind: 'positional', required: true, description: 'registered target path' }],
  async execute(ctx, params) {
    const path = params.positionals[0]
    if (!path) return fail('path required')
    const targets = loadTargets(ctx.repoRoot)
    if (!targets.some((t) => t.path === path)) return fail(`unknown target: ${path}`)
    saveTargets(ctx.repoRoot, targets.filter((t) => t.path !== path))
    return { ok: true, message: `removed target ${path}` }
  },
}

function isSubscribableRule(repoRoot: string, name: string): string | null {
  const row = loadOverview(repoRoot).find((r) => r.asset.name === name)
  if (!row) return `unknown asset: ${name}`
  if (row.asset.kind !== 'rule') return `${name} is not a rule`
  if (row.status === 'stub' || row.status === 'unbuilt') return `${name} has no built artifact (status: ${row.status})`
  return null
}

const targetsSubscribeAction: ActionDef = {
  id: 'targets:subscribe',
  summary: 'Subscribe a target to a built rule artifact',
  kind: 'mutation',
  args: [
    { name: 'path', kind: 'positional', required: true, description: 'registered target path' },
    { name: 'rule', kind: 'positional', required: true, description: 'rule asset name' },
  ],
  async execute(ctx, params) {
    const [path, rule] = params.positionals
    if (!path || !rule) return fail('path and rule required')
    const targets = loadTargets(ctx.repoRoot)
    const target = targets.find((t) => t.path === path)
    if (!target) return fail(`unknown target: ${path}`)
    const err = isSubscribableRule(ctx.repoRoot, rule)
    if (err) return fail(err)
    if (target.subscriptions.includes(rule)) return fail(`${path} already subscribes to ${rule}`)
    saveTargets(
      ctx.repoRoot,
      targets.map((t) => (t.path === path ? { ...t, subscriptions: [...t.subscriptions, rule] } : t)),
    )
    return { ok: true, message: `${path} subscribed to ${rule}` }
  },
}

const targetsUnsubscribeAction: ActionDef = {
  id: 'targets:unsubscribe',
  summary: 'Remove a rule subscription from a target',
  kind: 'mutation',
  args: [
    { name: 'path', kind: 'positional', required: true, description: 'registered target path' },
    { name: 'rule', kind: 'positional', required: true, description: 'rule asset name' },
  ],
  async execute(ctx, params) {
    const [path, rule] = params.positionals
    if (!path || !rule) return fail('path and rule required')
    const targets = loadTargets(ctx.repoRoot)
    const target = targets.find((t) => t.path === path)
    if (!target) return fail(`unknown target: ${path}`)
    if (!target.subscriptions.includes(rule)) return fail(`${path} does not subscribe to ${rule}`)
    saveTargets(
      ctx.repoRoot,
      targets.map((t) =>
        t.path === path ? { ...t, subscriptions: t.subscriptions.filter((s) => s !== rule) } : t,
      ),
    )
    return { ok: true, message: `${path} unsubscribed from ${rule}` }
  },
}

const skillsFixAction: ActionDef = {
  id: 'skills:fix',
  summary: 'Add unledgered skill directories to skills.json as custom entries',
  kind: 'mutation',
  args: [],
  async execute(ctx) {
    const { added, issues } = fixSkillsLedger(ctx.repoRoot)
    const parts = [added.length > 0 ? `added: ${added.join(', ')}` : 'nothing to fix']
    for (const issue of issues) parts.push(`[${issue.kind}] ${issue.dir}: ${issue.detail}`)
    return { ok: issues.length === 0, message: parts.join('\n'), exitCode: issues.length > 0 ? 1 : 0 }
  },
}

const skillsUpdateAction: ActionDef = {
  id: 'skills:update',
  summary: 'Update outdated mirror skills from upstream and rewrite the ledger',
  kind: 'mutation',
  args: [],
  async execute(ctx, _params, hooks) {
    const mirrors = await checkMirrors(loadSkills(ctx.repoRoot), ctx.run)
    const outdated = mirrors.filter((m) => m.outdated)
    if (outdated.length === 0) return { ok: true, message: 'all mirrors up-to-date' }
    for (const m of outdated) {
      hooks?.onText?.(`updating ${m.name} ${m.localCommit.slice(0, 7)} -> ${m.remoteCommit.slice(0, 7)}`)
      await updateMirror(ctx.repoRoot, m, ctx.now().slice(0, 10), ctx.download)
    }
    return { ok: true, message: `updated: ${outdated.map((m) => m.name).join(', ')}` }
  },
}
```

- [ ] **Step 4: 验证并提交**

```bash
bun test && pnpm --filter @infra-ai/meta-cli typecheck && pnpm --filter @infra-ai/meta-cli lint
git add packages/meta-cli/src/core/actions.ts packages/meta-cli/tests/actions.test.ts
git commit -m "feat(meta-cli): add targets and skills mutation actions"
```

---

### Task 5: CLI 生成层与入口分流

**Files:**
- Create: `packages/meta-cli/src/cli/render.ts`
- Create: `packages/meta-cli/src/cli/index.ts`
- Modify: `packages/meta-cli/src/index.tsx`
- Test: `packages/meta-cli/tests/cli.test.ts`

**Interfaces:**
- Consumes: Task 2-4 的 `ACTIONS`、`defaultContext`、`ActionDef`、`ActionParams`、`StatusRowData`、`SkillsStatusData`；`Target`（registry）
- Produces:
  - `renderStatus(rows: StatusRowData[]): string`、`renderTargets(targets: Target[]): string`、`renderSkills(data: SkillsStatusData): string`（纯函数）
  - `buildMainCommand(): CommandDef`（citty 命令树；Task 7 parity 测试遍历它）
  - `runCli(): Promise<void>`
  - `src/index.tsx`：argv 有内容走 CLI，否则渲染 TUI（skills.json 守卫保留在最前）

设计说明（生成规则，实现按此写死）：
- 注册表 id 含 `:` 的按前缀分组为 citty 嵌套子命令（`targets:add` → `meta targets add`）
- positional 不在 citty args 里声明（统一从 `args._` 读，required 校验已在 execute 内），
  用法写进命令 description：`summary` + `usage: <positional...>`
- flag 声明为 `{ type: 'boolean' }`；query 类额外自动加 `json` flag
- run handler：`execute(defaultContext(process.cwd()), params, { onText: console.log })`；
  失败 → message 打 stderr；query 成功 → `--json` 输出 `JSON.stringify(data, null, 2)`，
  否则走对应 renderer；mutation 成功 → message 打 stdout；
  `process.exitCode = result.exitCode ?? (result.ok ? 0 : 1)`

- [ ] **Step 1: 写失败测试**

`packages/meta-cli/tests/cli.test.ts`：

```ts
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderSkills, renderStatus, renderTargets } from '../src/cli/render'
import { runCommand } from '../src/core/io'
import { sha256 } from '../src/core/io'

const INDEX = join(import.meta.dir, '..', 'src', 'index.tsx')

function cliFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
  writeFileSync(join(root, 'skills.json'), '[]\n')
  mkdirSync(join(root, 'meta/rules'), { recursive: true })
  writeFileSync(
    join(root, 'meta/rules/foo.md'),
    '---\nname: foo\ntarget: rule\nstatus: ready\nscope: global\n---\nbody\n',
  )
  return root
}

describe('renderers', () => {
  test('renderStatus aligns rows and shows downstream summary for rules', () => {
    const out = renderStatus([
      {
        name: 'foo',
        kind: 'rule',
        status: 'synced',
        scope: 'global',
        metaPath: 'meta/rules/foo.md',
        artifactPath: 'rules/global/foo.md',
        downstream: { synced: 1, drift: 0, missing: 1 },
        targets: [],
      },
    ])
    expect(out).toContain('foo')
    expect(out).toContain('1 synced, 1 missing')
  })
  test('renderTargets and renderSkills produce deterministic text', () => {
    expect(renderTargets([])).toBe('no targets')
    expect(renderTargets([{ path: '/a', subscriptions: ['x'] }])).toBe('/a  [x]')
    const out = renderSkills({
      issues: [],
      mirrors: [{ name: 'm', localCommit: 'aaaaaaa1', remoteCommit: 'aaaaaaa1', outdated: false }],
      installed: ['s1'],
      recommendations: [{ name: 'r', repo: 'o/r' }],
    })
    expect(out).toContain('ledger clean')
    expect(out).toContain('[up-to-date] m')
    expect(out).toContain('s1')
    expect(out).toContain('pnpx skills add o/r')
  })
})

describe('cli end-to-end', () => {
  test('status --json exits 1 on unbuilt asset with row data', async () => {
    const root = cliFixture()
    try {
      const res = await runCommand('bun', ['run', INDEX, 'status', '--json'], { cwd: root })
      expect(res.code).toBe(1)
      const rows = JSON.parse(res.stdout) as { name: string; status: string }[]
      expect(rows[0]?.name).toBe('foo')
      expect(rows[0]?.status).toBe('unbuilt')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('status exits 0 when synced', async () => {
    const root = cliFixture()
    try {
      const meta = readFileSync(join(root, 'meta/rules/foo.md'), 'utf8')
      mkdirSync(join(root, 'rules/global'), { recursive: true })
      writeFileSync(join(root, 'rules/global/foo.md'), '# foo\n')
      writeFileSync(
        join(root, 'artifacts.lock.json'),
        `${JSON.stringify({ 'rule:foo': { metaHash: sha256(meta), artifactHash: sha256('# foo\n'), builtAt: 't' } })}\n`,
      )
      const res = await runCommand('bun', ['run', INDEX, 'status'], { cwd: root })
      expect(res.code).toBe(0)
      expect(res.stdout).toContain('synced')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('adopt via subcommand writes the lock; failure paths exit 1 with stderr', async () => {
    const root = cliFixture()
    try {
      mkdirSync(join(root, 'rules/global'), { recursive: true })
      writeFileSync(join(root, 'rules/global/foo.md'), '# foo\n')
      const ok = await runCommand('bun', ['run', INDEX, 'adopt', 'foo'], { cwd: root })
      expect(ok.code).toBe(0)
      const lock = JSON.parse(readFileSync(join(root, 'artifacts.lock.json'), 'utf8')) as Record<string, unknown>
      expect(lock['rule:foo']).toBeDefined()
      const bad = await runCommand('bun', ['run', INDEX, 'adopt', 'nope'], { cwd: root })
      expect(bad.code).toBe(1)
      expect(bad.stderr).toContain('unknown asset')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('nested targets commands work end-to-end', async () => {
    const root = cliFixture()
    try {
      const add = await runCommand('bun', ['run', INDEX, 'targets', 'add', '/tmp/cli-demo'], { cwd: root })
      expect(add.code).toBe(0)
      const dup = await runCommand('bun', ['run', INDEX, 'targets', 'add', '/tmp/cli-demo'], { cwd: root })
      expect(dup.code).toBe(1)
      const list = await runCommand('bun', ['run', INDEX, 'targets', 'list', '--json'], { cwd: root })
      expect(JSON.parse(list.stdout)).toEqual([{ path: '/tmp/cli-demo', subscriptions: [] }])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('running outside a repo root fails fast', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'meta-cli-empty-'))
    try {
      const res = await runCommand('bun', ['run', INDEX, 'status'], { cwd: empty })
      expect(res.code).toBe(1)
      expect(res.stderr).toContain('skills.json not found')
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
bun test tests/cli.test.ts
```

期望：FAIL（render 模块不存在）。

- [ ] **Step 3: 实现 render.ts**

```bash
pnpm --filter @infra-ai/meta-cli add citty
```

`packages/meta-cli/src/cli/render.ts`：

```ts
import type { SkillsStatusData, StatusRowData } from '../core/actions'
import type { Target } from '../core/registry'

function downstreamSummary(row: StatusRowData): string {
  if (row.kind !== 'rule') return ''
  const d = row.downstream
  if (d.synced + d.drift + d.missing === 0) return 'no subscribers'
  const parts: string[] = []
  if (d.synced > 0) parts.push(`${d.synced} synced`)
  if (d.drift > 0) parts.push(`${d.drift} drift`)
  if (d.missing > 0) parts.push(`${d.missing} missing`)
  return parts.join(', ')
}

export function renderStatus(rows: StatusRowData[]): string {
  if (rows.length === 0) return 'no assets'
  return rows
    .map((r) => `${r.name.padEnd(20)} ${r.kind.padEnd(8)} ${r.status.padEnd(10)} ${downstreamSummary(r)}`.trimEnd())
    .join('\n')
}

export function renderTargets(targets: Target[]): string {
  if (targets.length === 0) return 'no targets'
  return targets.map((t) => `${t.path}  [${t.subscriptions.join(', ')}]`).join('\n')
}

export function renderSkills(data: SkillsStatusData): string {
  const lines: string[] = []
  lines.push('ledger')
  if (data.issues.length === 0) lines.push('  ledger clean')
  for (const issue of data.issues) lines.push(`  [${issue.kind}] ${issue.dir}: ${issue.detail}`)
  lines.push('mirrors')
  if (data.mirrors.length === 0) lines.push('  no mirrors')
  for (const m of data.mirrors) {
    lines.push(
      m.outdated
        ? `  [outdated] ${m.name} ${m.localCommit.slice(0, 7)} -> ${m.remoteCommit.slice(0, 7)}`
        : `  [up-to-date] ${m.name}`,
    )
  }
  lines.push('installed')
  for (const s of data.installed) lines.push(`  ${s}`)
  lines.push('recommended')
  if (data.recommendations.length === 0) lines.push('  none')
  for (const r of data.recommendations) lines.push(`  ${r.name.padEnd(24)} pnpx skills add ${r.repo}`)
  return lines.join('\n')
}
```

- [ ] **Step 4: 实现 cli/index.ts 与入口分流**

`packages/meta-cli/src/cli/index.ts`：

```ts
import { defineCommand, runMain } from 'citty'
import type { CommandDef } from 'citty'
import { ACTIONS, defaultContext } from '../core/actions'
import type { ActionDef, ActionParams, SkillsStatusData, StatusRowData } from '../core/actions'
import type { Target } from '../core/registry'
import { renderSkills, renderStatus, renderTargets } from './render'

const QUERY_RENDERERS: Record<string, (data: unknown) => string> = {
  status: (d) => renderStatus(d as StatusRowData[]),
  'targets:list': (d) => renderTargets(d as Target[]),
  'skills:status': (d) => renderSkills(d as SkillsStatusData),
}

function usage(action: ActionDef): string {
  const positionals = action.args
    .filter((a) => a.kind === 'positional')
    .map((a) => {
      const name = a.variadic ? `${a.name}...` : a.name
      return a.required ? `<${name}>` : `[${name}]`
    })
    .join(' ')
  return positionals === '' ? action.summary : `${action.summary} (usage: ${positionals})`
}

function paramsFrom(args: Record<string, unknown>): ActionParams {
  const raw = args._
  const positionals = Array.isArray(raw) ? raw.map(String) : []
  const flags: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(args)) {
    if (key !== '_' && typeof value === 'boolean') flags[key] = value
  }
  return { positionals, flags }
}

function commandFor(action: ActionDef): CommandDef {
  const args: Record<string, { type: 'boolean'; description: string }> = {}
  for (const spec of action.args) {
    if (spec.kind === 'flag') args[spec.name] = { type: 'boolean', description: spec.description }
  }
  if (action.kind === 'query') args.json = { type: 'boolean', description: 'output JSON' }
  const leaf = action.id.includes(':') ? action.id.slice(action.id.indexOf(':') + 1) : action.id
  return defineCommand({
    meta: { name: leaf, description: usage(action) },
    args,
    async run(cmdCtx) {
      const cmdArgs = cmdCtx.args as Record<string, unknown>
      const params = paramsFrom(cmdArgs)
      const result = await action.execute(defaultContext(process.cwd()), params, {
        onText: (t) => console.log(t),
      })
      if (!result.ok) {
        console.error(result.message ?? 'failed')
      } else if (action.kind === 'query') {
        const renderer = QUERY_RENDERERS[action.id]
        console.log(
          cmdArgs.json === true || renderer === undefined
            ? JSON.stringify(result.data, null, 2)
            : renderer(result.data),
        )
      } else if (result.message) {
        console.log(result.message)
      }
      process.exitCode = result.exitCode ?? (result.ok ? 0 : 1)
    },
  })
}

export function buildMainCommand(): CommandDef {
  const subCommands: Record<string, CommandDef> = {}
  const groups = new Map<string, Record<string, CommandDef>>()
  for (const action of ACTIONS) {
    if (action.id.includes(':')) {
      const group = action.id.slice(0, action.id.indexOf(':'))
      const leaf = action.id.slice(action.id.indexOf(':') + 1)
      const entry = groups.get(group) ?? {}
      entry[leaf] = commandFor(action)
      groups.set(group, entry)
    } else {
      subCommands[action.id] = commandFor(action)
    }
  }
  for (const [group, leaves] of groups) {
    subCommands[group] = defineCommand({
      meta: { name: group, description: `${group} operations` },
      subCommands: leaves,
    })
  }
  return defineCommand({
    meta: { name: 'meta', description: 'infra-ai meta asset maintenance' },
    subCommands,
  })
}

export async function runCli(): Promise<void> {
  await runMain(buildMainCommand())
}
```

`packages/meta-cli/src/index.tsx` 全量替换：

```tsx
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = process.cwd()
if (!existsSync(join(repoRoot, 'skills.json'))) {
  console.error('meta-cli must run from the infra-ai repo root (skills.json not found)')
  process.exit(1)
}

if (process.argv.length > 2) {
  const { runCli } = await import('./cli/index')
  await runCli()
} else {
  const { render } = await import('ink')
  const { App } = await import('./tui/app')
  render(<App repoRoot={repoRoot} />)
}
```

（动态 import 让命令式路径不加载 ink/react。）

- [ ] **Step 5: 验证并提交**

```bash
bun test && pnpm --filter @infra-ai/meta-cli typecheck && pnpm --filter @infra-ai/meta-cli lint
cd /Users/xiu/code/infra-ai && pnpm meta status; echo "exit=$?"   # 期望: 资产列表文本, exit=1（当前有 stub/unbuilt 时 unbuilt 计入）
pnpm meta --help                                                  # 期望: citty 帮助列出全部子命令
git add packages/meta-cli pnpm-lock.yaml
git commit -m "feat(meta-cli): add citty command mode generated from action registry"
```

---

### Task 6: TUI 改接注册表与 keymap

**Files:**
- Create: `packages/meta-cli/src/tui/keymap.ts`
- Modify: `packages/meta-cli/src/tui/app.tsx`
- Modify: `packages/meta-cli/src/tui/targets-view.tsx`
- Modify: `packages/meta-cli/src/tui/skills-view.tsx`

**Interfaces:**
- Consumes: `getAction`、`defaultContext`、`ActionContext`（Task 2-4）
- Produces: `KEYMAP: KeymapEntry[]`，`interface KeymapEntry { actionId: string; view: 'assets' | 'targets' | 'detail' | 'skills'; key?: string }`（Task 7 parity 测试消费）

本任务是对现有组件的编织式修改：实现者先读当前文件再整合，交互流程与渲染不变，
只把「直接调 core 函数的编排」换成「调注册表 execute」。

- [ ] **Step 1: 写 keymap.ts**

```ts
export interface KeymapEntry {
  actionId: string
  view: 'assets' | 'targets' | 'detail' | 'skills'
  key?: string
}

// key 缺省表示该 query 动作由视图本身承载。
// 子视图组件内的按键绑定必须与本表一致（parity 测试保证动作覆盖，不校验绑定本身）。
export const KEYMAP: KeymapEntry[] = [
  { actionId: 'status', view: 'assets' },
  { actionId: 'adopt', view: 'assets', key: 'a' },
  { actionId: 'build', view: 'assets', key: 'b' },
  { actionId: 'writeback', view: 'assets', key: 'w' },
  { actionId: 'dist', view: 'assets', key: 'd' },
  { actionId: 'targets:list', view: 'targets' },
  { actionId: 'targets:add', view: 'targets', key: 'n' },
  { actionId: 'targets:remove', view: 'targets', key: 'x' },
  { actionId: 'targets:subscribe', view: 'targets', key: 'space' },
  { actionId: 'targets:unsubscribe', view: 'targets', key: 'space' },
  { actionId: 'skills:status', view: 'skills' },
  { actionId: 'skills:fix', view: 'skills', key: 'f' },
  { actionId: 'skills:update', view: 'skills', key: 'u' },
]
```

（`B`/`D` 是 `build --stale` / `dist --all` 的批量入口，同一 action，不单列。）

- [ ] **Step 2: app.tsx 改接**

读当前 `packages/meta-cli/src/tui/app.tsx`，做如下替换（其余结构、视图切换、
RunPanel、confirmQuit 逻辑不动）：

新增 import 与组件内 ctx：

```tsx
import { useMemo } from 'react'   // 并入现有 react import
import { defaultContext, getAction } from '../core/actions'
```

```tsx
const ctx = useMemo(() => defaultContext(repoRoot), [repoRoot])
```

删除本文件内的 `buildOne` 回调与对 `runClaude/buildPromptFor/writebackPromptFor/allowedToolsFor/verifyBuild/recordBuild/gatherFacts/adoptEntry/loadLock/saveLock/distribute/downstreamStates(仅动作用途)/subscribers` 的动作类调用与 import（`downstreamStates`/`loadTargets` 若 detail 视图渲染仍需则保留），处理器替换为：

```tsx
if (input === 'a' && row.status === 'untracked') {
  void getAction('adopt').execute(ctx, { positionals: [row.asset.name], flags: {} }).then(reload)
}
if (input === 'b' && row.status !== 'stub') {
  runJob(`build ${row.asset.name}`, (onText) =>
    getAction('build')
      .execute(ctx, { positionals: [row.asset.name], flags: {} }, { onText })
      .then((r) => (r.ok ? null : (r.message ?? 'failed'))),
  )
}
if (input === 'B') {
  runJob('build stale assets', (onText) =>
    getAction('build')
      .execute(ctx, { positionals: [], flags: { stale: true } }, { onText })
      .then((r) => (r.ok ? null : (r.message ?? 'failed'))),
  )
}
if (input === 'w' && row.status === 'dirty') {
  runJob(`writeback ${row.asset.name}`, (onText) =>
    getAction('writeback')
      .execute(ctx, { positionals: [row.asset.name], flags: {} }, { onText })
      .then((r) => (r.ok ? null : (r.message ?? 'failed'))),
  )
}
if (input === 'd' && row.asset.kind === 'rule') {
  runJob(`dist ${row.asset.name}`, (onText) =>
    getAction('dist')
      .execute(ctx, { positionals: [row.asset.name], flags: {} }, { onText })
      .then((r) => (r.ok ? null : (r.message ?? 'failed'))),
  )
}
if (input === 'D') {
  runJob('dist all pending', (onText) =>
    getAction('dist')
      .execute(ctx, { positionals: [], flags: { all: true } }, { onText })
      .then((r) => (r.ok ? null : (r.message ?? 'failed'))),
  )
}
```

行为说明：`dist` 单资产在无订阅方时现在会以 job 失败显示 message（原为静默 0 目标 job），
`B` 在无 stale 时 job 直接 done 显示 'no stale assets'——两者都是注册表统一语义，接受。

- [ ] **Step 3: targets-view.tsx 与 skills-view.tsx 改接**

`targets-view.tsx`：组件增加 prop `ctx: ActionContext`（由 app.tsx 传入）；
`persist` 删除，改为动作调用后从 `loadTargets(repoRoot)` 重读：

```tsx
const refresh = () => setTargets(loadTargets(repoRoot))
// n 提交（TextInput onSubmit）:
void getAction('targets:add').execute(ctx, { positionals: [value.trim()], flags: {} }).then(refresh)
// x:
void getAction('targets:remove').execute(ctx, { positionals: [target.path], flags: {} }).then(refresh)
// space（订阅切换，按当前是否已订阅二选一）:
const actionId = target.subscriptions.includes(rule) ? 'targets:unsubscribe' : 'targets:subscribe'
void getAction(actionId).execute(ctx, { positionals: [target.path, rule], flags: {} }).then(refresh)
```

失败结果（如重复路径）在列表下方以一行 `notice` 状态展示（新增 `const [notice, setNotice] = useState<string | null>(null)`，
`.then((r) => { if (!r.ok) setNotice(r.message ?? 'failed'); refresh() })`，渲染在键位提示上方）。

`skills-view.tsx`：`f`/`u` 处理器改为：

```tsx
if (input === 'f') {
  void getAction('skills:fix').execute(ctx, { positionals: [], flags: {} }).then((r) => {
    if (mountedRef.current) {
      setIssues(checkSkillsLedger(repoRoot))
      setNotice(r.message ?? null)
    }
  })
}
if (input === 'u' && mirrors) {
  setBusy(true)
  void getAction('skills:update')
    .execute(ctx, { positionals: [], flags: {} }, { onText: (t) => mountedRef.current && setNotice(t) })
    .then((r) => {
      if (!mountedRef.current) return
      setNotice(r.message ?? null)
      return checkMirrors(loadSkills(repoRoot), runCommand).then((m) => {
        if (mountedRef.current) setMirrors(m)
      })
    })
    .catch((error) => mountedRef.current && setNotice(String(error)))
    .finally(() => mountedRef.current && setBusy(false))
}
```

组件同样增加 `ctx: ActionContext` prop；app.tsx 渲染分支传 `ctx={ctx}`。
不再直接 import `fixSkillsLedger`/`updateMirror`（checkMirrors/loadSkills 保留用于刷新）。

- [ ] **Step 4: 验证并提交**

```bash
bun test && pnpm --filter @infra-ai/meta-cli typecheck && pnpm --filter @infra-ai/meta-cli lint
pnpm meta </dev/null 2>&1 | head -15    # 期望: 首帧资产列表正常渲染（raw-mode 报错属预期）
git add packages/meta-cli/src/tui
git commit -m "refactor(meta-cli): route TUI actions through the registry with declarative keymap"
```

---

### Task 7: parity 测试与文档收尾

**Files:**
- Test: `packages/meta-cli/tests/parity.test.ts`
- Modify: `.claude/rules/architecture.md`
- Modify: `.claude/CLAUDE.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: `ACTIONS`（Task 2-4）、`KEYMAP`（Task 6）、`buildMainCommand`（Task 5）

- [ ] **Step 1: 写 parity 测试（预期直接通过——它是回归门）**

`packages/meta-cli/tests/parity.test.ts`：

```ts
import { describe, expect, test } from 'bun:test'
import { buildMainCommand } from '../src/cli/index'
import { ACTIONS } from '../src/core/actions'
import { KEYMAP } from '../src/tui/keymap'

describe('frontend parity', () => {
  test('every registry action is reachable from the TUI keymap', () => {
    const mapped = new Set(KEYMAP.map((e) => e.actionId))
    for (const action of ACTIONS) {
      expect(mapped.has(action.id), `action ${action.id} missing from keymap`).toBe(true)
    }
  })
  test('keymap references only real actions', () => {
    const ids = new Set(ACTIONS.map((a) => a.id))
    for (const entry of KEYMAP) {
      expect(ids.has(entry.actionId), `keymap references unknown action ${entry.actionId}`).toBe(true)
    }
  })
  test('CLI command tree covers exactly the registry ids', async () => {
    const main = buildMainCommand()
    const subCommands = (await Promise.resolve(main.subCommands)) as Record<string, unknown>
    const ids: string[] = []
    for (const [name, sub] of Object.entries(subCommands)) {
      const resolved = (await Promise.resolve(sub)) as { subCommands?: Record<string, unknown> }
      if (resolved.subCommands) {
        for (const leaf of Object.keys(resolved.subCommands)) ids.push(`${name}:${leaf}`)
      } else {
        ids.push(name)
      }
    }
    expect(new Set(ids)).toEqual(new Set(ACTIONS.map((a) => a.id)))
  })
})
```

```bash
bun test tests/parity.test.ts    # 期望: 3 pass
```

- [ ] **Step 2: 文档**

`.claude/rules/architecture.md` 在「对账」节后追加：

```markdown
## 动作注册表（功能同步红线）

- `packages/meta-cli/src/core/actions.ts` 是全部维护动作的 SSoT：
  CLI 子命令由它生成，TUI 键位在 `src/tui/keymap.ts` 声明
- 新增动作必须先进注册表，再接 keymap；`tests/parity.test.ts` 不过不得提交
```

`.claude/CLAUDE.md` 命令小节的代码块替换为：

```bash
make meta                 # TUI：对账、构建、分发、回写
pnpm meta status          # 命令式（面向 AI/脚本）：完整命令面见 pnpm meta --help
```

`README.md` 命令小节的代码块替换为：

```bash
make meta                     # TUI
pnpm meta status [--json]     # 对账查询；有待收敛项时退出码为 1
pnpm meta build <name>        # claude headless 构建；完整命令面 pnpm meta --help
```

- [ ] **Step 3: 全量验证并提交**

```bash
bun test && pnpm --filter @infra-ai/meta-cli typecheck && pnpm --filter @infra-ai/meta-cli lint
pnpm meta targets list && pnpm meta --help
git add packages/meta-cli/tests/parity.test.ts README.md
git add -f .claude/rules/architecture.md .claude/CLAUDE.md
git commit -m "feat(meta-cli): enforce TUI/CLI parity and document command mode"
```

---

## Self-Review 记录

- Spec 覆盖：Decision 1（Task 5 入口分流）、2（Task 5 citty）、3（Task 2-4 注册表 + 编排下沉）、
  4（Task 5 生成）、5（Task 6 keymap）、6（Task 7 parity + 红线）、7（Task 2/5 退出码与 --json）；
  命令面全部 13 个动作对应 spec 清单；giget 程序化（Task 1，用户批准并入）。
- spec 之外的裁决已注明：untracked 不计入 status 退出码（spec 字面）；dist 无订阅方改为显式报错；
  giget `--force`→`forceClean` 语义修正。
- 类型一致性：`ActionContext/ActionParams/ActionResult/ActionDef/StatusRowData/SkillsStatusData/DownloadFn/KeymapEntry`
  在 Interfaces 块、实现与测试间签名一致；`updateMirror(repoRoot, status, today, download)` 新签名
  在 Task 1/4/6 三处一致。
- 已知风险（执行时注意）：citty `args._` 的 positional 行为以运行为准，Task 5 的 E2E 测试即是验收；
  `main.subCommands` 可能是 lazy resolvable，parity 测试用 `Promise.resolve` 兜底。
