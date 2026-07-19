# iuse 全局 scope 只读对账 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iuse 的 status/diff/list 获得 `--global` scope(对账 `~/.claude` 与中心源,只读,输出建议命令),源端新增 globals.json 账。

**Architecture:** 全局与项目同构为 scope 之别:全局的期望集来自源仓根 `globals.json`(全局的 profile),无 lock 无基线,两态对账(synced/differs/missing)+ unmanaged 提示 + 跨层 duplicate 检测。iuse MUST NOT 写 `~/.claude` 下任何文件。`--global` 即 Claude Code 的 user scope。

**Tech Stack:** Bun + TypeScript、citty(零新依赖)。

**Spec:** `docs/superpowers/specs/2026-07-19-iuse-global-scope-design.md`(一切以 spec 为准)

## Global Constraints

- **只读铁律:全局路径(`~/.claude`,测试中以 fixture home 模拟)上不得出现任何写调用;测试必须断言对账前后 home 目录逐文件内容不变**
- 文件与目录 kebab-case;源代码禁 emoji;commit 英文 Conventional Commits
- commit trailer:`Claude-Session: https://claude.ai/code/session_014qFwy6t5VhLF85toupsepd`
- 禁 `!` 非空断言、`@ts-ignore`、双重断言;oxlint + `bunx tsc --noEmit` 必须全绿
- 帮助文本中文为主;`--json` 单行 JSON;实时 LSP 诊断不作准,批次后 tsc 为权威
- duplicate 与 unmanaged 不影响退出码;differs/missing 退 1
- 每个 task 内测试先行(Red-Green),task 完成即 commit

## 现有契约速览(实现者必读)

- `packages/meta-cli/src/core/composition.ts`:`loadProfiles(root)`、`validateComposition`;`meta.ts`:`discoverAssets(repoRoot)` 返回 `MetaAsset { name, kind, status('stub'|'ready'), ... }`;`io.ts`:`readTextIfExists`、`sha256`;导出面在 `core/index.ts`
- `packages/meta-cli/src/core/actions.ts`:statusAction 的 execute 末尾已有 `catalogStaleness` violation 挂钩(搜 `catalogStaleness`),globals 校验照此追加
- `packages/iuse/src/core/manifest.ts`:`ruleTargetRelPath(rule)` 返回 `.claude/rules/<rule>.md`——**全局副本路径 = `join(ctx.home, ruleTargetRelPath(rule))`**,home 即全局 scope 的 target root
- `packages/iuse/src/core/list.ts`:`listReport(ctx, { source?, target, tags?, grep? })`、`installStateFor`、`ListRow { name, description, tags, scope, state?: InstallState }`
- `packages/iuse/src/core/diff.ts`:`diffReport(ctx, { source?, target, rule? })`,内部 `driftStateFor(localText, sourceText)` 返回 synced/outdated/missing,`countChanges`、`createTwoFilesPatch` 可复用
- `packages/iuse/src/core/report.ts`:`statusReport(ctx, { source?, target })` → `StatusResult { ok, message?, rows, exitCode }`
- `packages/iuse/src/cli/index.ts`:各命令 defineCommand;`splitNames`、`renderJson`、`defaultContext`(含 `home: homedir()`)
- iuse 测试 fixture 惯例:mkdtemp 源仓(meta/rules frontmatter 必须带 `description: x`,rules/global 产物,profiles.json,catalog.json 视需要),`fakeCtx({ home: <mkdtemp> })` 可注入假 home

---

### Task 1: 源端 globals 账(loadGlobals + imeta status 校验 + 仓库落账)

**Files:**
- Create: `packages/meta-cli/src/core/globals.ts`
- Modify: `packages/meta-cli/src/core/actions.ts`(statusAction 追加 globals violations)
- Modify: `packages/meta-cli/src/core/index.ts`(导出 loadGlobals、globalsViolations 及 Globals 类型)
- Create: `globals.json`(仓库根,初始 `{ "rules": ["markdown"] }`)
- Modify: `.claude/rules/architecture.md`(结构图 catalog.json 行后加 globals.json 一行)
- Test: `packages/meta-cli/tests/globals.test.ts`(新建)

**Interfaces:**
- Consumes: `discoverAssets`、`readTextIfExists`
- Produces(Task 2/3 依赖,签名必须一致):

```ts
export interface Globals { rules: string[] }
export function loadGlobals(root: string): Globals | null
// 无 globals.json 返回 null;坏 JSON 或 rules 非字符串数组抛错
export function globalsViolations(repoRoot: string): string[]
// 无文件返回 [](未建立=合法);引用未知 rule → `globals.json: unknown rule '<name>'`;
// 引用非 ready rule → `globals.json: rule '<name>' is not ready`
```

- [ ] **Step 1: 失败测试**

`packages/meta-cli/tests/globals.test.ts`:

```ts
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { globalsViolations, loadGlobals } from '../src/core/globals'

function repoWith(rules: Array<{ name: string; status: string }>, globals?: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'imeta-globals-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  for (const r of rules) {
    writeFileSync(
      join(dir, 'meta', 'rules', `${r.name}.md`),
      `---\nname: ${r.name}\nstatus: ${r.status}\ndescription: x\nscope: global\ntags: [core]\n---\nbody`,
    )
  }
  if (globals !== undefined) writeFileSync(join(dir, 'globals.json'), JSON.stringify(globals))
  return dir
}

describe('globals', () => {
  test('loadGlobals: missing file null; well-formed parses; bad shape throws', () => {
    expect(loadGlobals(repoWith([]))).toBeNull()
    expect(loadGlobals(repoWith([], { rules: ['markdown'] }))).toEqual({ rules: ['markdown'] })
    expect(() => loadGlobals(repoWith([], { rules: 'markdown' }))).toThrow('globals.json')
  })

  test('globalsViolations: absent ok; unknown and non-ready rules flagged', () => {
    expect(globalsViolations(repoWith([{ name: 'a', status: 'ready' }]))).toEqual([])
    const repo = repoWith(
      [{ name: 'a', status: 'ready' }, { name: 'b', status: 'stub' }],
      { rules: ['a', 'b', 'ghost'] },
    )
    const violations = globalsViolations(repo)
    expect(violations).toContain("globals.json: rule 'b' is not ready")
    expect(violations).toContain("globals.json: unknown rule 'ghost'")
    expect(violations.some((v) => v.includes("'a'"))).toBe(false)
  })
})
```

- [ ] **Step 2: 确认失败**

Run: `cd packages/meta-cli && bun test tests/globals.test.ts`
Expected: FAIL(模块不存在)

- [ ] **Step 3: 实现 globals.ts**

```ts
import { join } from 'node:path'
import { readTextIfExists } from './io'
import { discoverAssets } from './meta'

export interface Globals {
  rules: string[]
}

export function loadGlobals(root: string): Globals | null {
  const raw = readTextIfExists(join(root, 'globals.json'))
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`globals.json: invalid JSON (${String(error)})`, { cause: error })
  }
  const rules = (parsed as { rules?: unknown }).rules
  if (!Array.isArray(rules) || rules.some((r) => typeof r !== 'string')) {
    throw new Error('globals.json: expected { "rules": string[] }')
  }
  return { rules: rules as string[] }
}

export function globalsViolations(repoRoot: string): string[] {
  let globals: Globals | null
  try {
    globals = loadGlobals(repoRoot)
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)]
  }
  if (globals === null) return []
  const byName = new Map(
    discoverAssets(repoRoot).filter((a) => a.kind === 'rule').map((a) => [a.name, a]),
  )
  const violations: string[] = []
  for (const name of globals.rules) {
    const asset = byName.get(name)
    if (asset === undefined) {
      violations.push(`globals.json: unknown rule '${name}'`)
      continue
    }
    if (asset.status !== 'ready') violations.push(`globals.json: rule '${name}' is not ready`)
  }
  return violations
}
```

注意 `rules as string[]` 是单层收窄断言(已逐元素校验),不是双重断言。跑 Step 1 测试至绿。

- [ ] **Step 4: statusAction 挂钩 + 导出 + 落账 + 结构图**

- actions.ts:在 `catalogStaleness` violation 追加处之后加 `violations.push(...globalsViolations(ctx.repoRoot))`(变量名对齐实际代码),import 从 './globals'
- core/index.ts:`export { globalsViolations, loadGlobals } from './globals'`、`export type { Globals } from './globals'`
- 仓库根建 `globals.json`:`{ "rules": ["markdown"] }`(换行结尾)
- `.claude/rules/architecture.md` 结构图 catalog.json 行后加:`├── globals.json  # 全局层账:~/.claude 应装 rule 清单(iuse --global 只读对账)`

- [ ] **Step 5: 全量验证 + Commit**

Run: `cd packages/meta-cli && bun run test && bunx tsc --noEmit && bun run lint`,然后仓库根 `pnpm meta status`(Expected: 退 0——markdown 是 ready rule)

```bash
git add packages/meta-cli globals.json .claude/rules/architecture.md
git commit -m "feat(meta): globals.json ledger with status validation"
```

---

### Task 2: iuse core——全局对账状态机、diff/list 的 global 分支、duplicate 检测

**Files:**
- Create: `packages/iuse/src/core/global.ts`
- Modify: `packages/iuse/src/core/diff.ts`(global 模式)
- Modify: `packages/iuse/src/core/list.ts`(global 模式状态标注)
- Modify: `packages/iuse/src/core/report.ts`(duplicates 字段)
- Test: `packages/iuse/tests/global.test.ts`(新建)、`tests/diff.test.ts`、`tests/list.test.ts`、`tests/report.test.ts`(追加)

**Interfaces:**
- Consumes: Task 1 `loadGlobals`(从 '@infra-ai/meta-cli/core');现有 `resolveSource`、`readTextIfExists`、`ruleTargetRelPath`、`loadDownstreamLock`、`assembleRules`
- Produces(Task 3 CLI 依赖):

```ts
// global.ts
export type GlobalState = 'synced' | 'differs' | 'missing' | 'unmanaged'
export interface GlobalRow { rule: string; state: GlobalState; suggestion?: string }
export interface GlobalStatusResult {
  ok: boolean
  message?: string
  rows: GlobalRow[]
  duplicates: string[]   // 同 rule 项目 lock.rules 且全局文件都存在
  exitCode: number
}
export async function globalStatusReport(
  ctx: IuseContext,
  opts: { source?: string; projectTarget?: string },
): Promise<GlobalStatusResult>

// diff.ts: opts 增 global?: boolean;RuleDiff.state 类型放宽为 DriftState | 'differs'
// list.ts: opts 增 global?: boolean;ListRow.state 类型放宽为 InstallState | 'differs'
// report.ts: StatusResult 增 duplicates?: string[](lock 存在时计算,exitCode 不受影响)
```

- [ ] **Step 1: 失败测试——globalStatusReport 状态机与只读不变量**

`packages/iuse/tests/global.test.ts`(fixture:mkdtemp 源仓含 alpha/beta 两条 ready rule 的 meta+产物+globals.json `{"rules":["alpha","beta"]}`;mkdtemp fakeHome,`.claude/rules/` 下 alpha.md 与源一致、beta.md 不建、再放一个 stray.md;`fakeCtx({ home: fakeHome })`——照抄 tests/list.test.ts 的 fixture 惯用法并加 home 注入):

```ts
test('global status: synced/differs/missing/unmanaged with suggestions, read-only', async () => {
  const before = snapshotDir(fakeHome) // { relPath: content } 全量快照 helper,本文件内实现
  const result = await globalStatusReport(fakeCtx({ home: fakeHome }), { source })
  expect(result.ok).toBe(true)

  const byRule = new Map(result.rows.map((r) => [r.rule, r]))
  expect(byRule.get('alpha')?.state).toBe('synced')
  expect(byRule.get('beta')?.state).toBe('missing')
  expect(byRule.get('beta')?.suggestion).toContain('cp ')
  expect(byRule.get('beta')?.suggestion).toContain('.claude/rules/beta.md')
  expect(byRule.get('stray')?.state).toBe('unmanaged')
  expect(result.exitCode).toBe(1) // missing 在场

  expect(snapshotDir(fakeHome)).toEqual(before) // 只读铁律
})

test('global status: differs carries diff hint; all-synced exits 0', async () => {
  // alpha 改内容 → differs,suggestion 含 'iuse diff --global --rule alpha'
  // 另一 fixture 全一致 → exitCode 0
})

test('globals.json missing at source fails with establishment hint', async () => {
  const result = await globalStatusReport(fakeCtx({ home: fakeHome }), { source: bareSource })
  expect(result.ok).toBe(false)
  expect(result.message).toContain('globals.json')
})

test('duplicate: rule in project lock and global file both present', async () => {
  // runInit 建项目 target(profile 含 alpha),fakeHome 放 alpha.md
  const result = await globalStatusReport(fakeCtx({ home: fakeHome }), { source, projectTarget: target })
  expect(result.duplicates).toEqual(['alpha'])
  // duplicates 不影响 exitCode:其余全 synced 时仍退 0
})
```

Run: `cd packages/iuse && bun test tests/global.test.ts` → FAIL

- [ ] **Step 2: 实现 global.ts**

```ts
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { loadCatalog, loadGlobals, readTextIfExists } from '@infra-ai/meta-cli/core'
import type { IuseContext } from './init'
import { loadDownstreamLock, ruleTargetRelPath } from './manifest'
import { resolveSource } from './source'

export type GlobalState = 'synced' | 'differs' | 'missing' | 'unmanaged'

export interface GlobalRow {
  rule: string
  state: GlobalState
  suggestion?: string
}

export interface GlobalStatusResult {
  ok: boolean
  message?: string
  rows: GlobalRow[]
  duplicates: string[]
  exitCode: number
}

function globalRulePath(home: string, rule: string): string {
  return join(home, ruleTargetRelPath(rule))
}

export async function globalStatusReport(
  ctx: IuseContext,
  opts: { source?: string; projectTarget?: string },
): Promise<GlobalStatusResult> {
  let source: Awaited<ReturnType<typeof resolveSource>>
  try {
    source = await resolveSource({
      explicit: opts.source,
      envRoot: ctx.env.INFRA_AI_ROOT,
      homeDefault: join(ctx.home, 'code/infra-ai'),
      cacheDir: ctx.cacheDir,
      download: ctx.download,
      run: ctx.run,
    })
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error), rows: [], duplicates: [], exitCode: 1 }
  }

  const globals = loadGlobals(source.root)
  if (globals === null) {
    return {
      ok: false,
      message: `${source.root}: globals.json missing -- declare the global-scope rule set there first (e.g. { "rules": ["markdown"] })`,
      rows: [],
      duplicates: [],
      exitCode: 1,
    }
  }

  const catalog = loadCatalog(source.root)
  const rows: GlobalRow[] = []
  for (const rule of [...globals.rules].toSorted()) {
    const artifactRelPath = catalog?.rules[rule]?.path ?? `rules/global/${rule}.md`
    const sourceText = readTextIfExists(join(source.root, artifactRelPath))
    const localText = readTextIfExists(globalRulePath(ctx.home, rule))
    if (localText === null) {
      rows.push({
        rule,
        state: 'missing',
        suggestion: `cp ${join(source.root, artifactRelPath)} ${globalRulePath(ctx.home, rule)}`,
      })
      continue
    }
    if (sourceText !== null && localText === sourceText) {
      rows.push({ rule, state: 'synced' })
      continue
    }
    rows.push({
      rule,
      state: 'differs',
      suggestion: `iuse diff --global --rule ${rule} 查看差异; 采纳源版本: cp ${join(source.root, artifactRelPath)} ${globalRulePath(ctx.home, rule)}`,
    })
  }

  const declared = new Set(globals.rules)
  const globalRulesDir = join(ctx.home, '.claude/rules')
  const present: string[] = (() => {
    try {
      return readdirSync(globalRulesDir).filter((f) => f.endsWith('.md'))
    } catch {
      return []
    }
  })()
  for (const file of present.toSorted()) {
    const name = file.replace(/\.md$/u, '')
    if (!declared.has(name)) rows.push({ rule: name, state: 'unmanaged' })
  }

  const duplicates: string[] = []
  if (opts.projectTarget !== undefined) {
    const lock = loadDownstreamLock(opts.projectTarget)
    if (lock !== null) {
      for (const rule of Object.keys(lock.rules).toSorted()) {
        if (readTextIfExists(globalRulePath(ctx.home, rule)) !== null) duplicates.push(rule)
      }
    }
  }

  const exitCode = rows.some((r) => r.state === 'differs' || r.state === 'missing') ? 1 : 0
  return { ok: true, rows, duplicates, exitCode }
}
```

跑 Step 1 测试至绿。

- [ ] **Step 3: 失败测试 + 实现——diff --global**

tests/diff.test.ts 追加:

```ts
test('global diff: declared set from globals.json, differs state, home untouched', async () => {
  // fixture: 源仓 globals.json {"rules":["alpha"]};fakeHome 的 alpha.md 内容与源不同
  const before = snapshotDir(fakeHome)
  const result = await diffReport(fakeCtx({ home: fakeHome }), { source, target: fakeHome, global: true })
  expect(result.ok).toBe(true)
  expect(result.diffs[0]?.rule).toBe('alpha')
  expect(result.diffs[0]?.state).toBe('differs')
  expect(result.exitCode).toBe(1)
  expect(snapshotDir(fakeHome)).toEqual(before)
})

test('global diff --rule unknown name lists declared rules', async () => {
  const result = await diffReport(fakeCtx({ home: fakeHome }), { source, target: fakeHome, rule: 'ghost', global: true })
  expect(result.ok).toBe(false)
  expect(result.message).toContain('alpha')
})
```

实现 diff.ts:`opts` 增 `global?: boolean`;`RuleDiff.state` 放宽为 `DriftState | 'differs'`。global 分支:跳过 loadDownstreamLock,声明集 = `loadGlobals(source.root)`(null → fail 同 global.ts 文案);`assembleRules(source.root, globals.rules)`;local 路径 = `join(opts.target, ruleTargetRelPath(rule))`(CLI 层会把 target 设为 ctx.home);状态映射:`driftStateFor` 结果为 'outdated' 时在 global 模式下改写为 'differs';无 excluded 概念;`--rule` 未知名报 `unknown rule '<name>' (declared rules: ...)`。非 global 路径行为零变化。

- [ ] **Step 4: 失败测试 + 实现——list --global**

tests/list.test.ts 追加:

```ts
test('global list: declared synced/differs/missing, undeclared uninstalled', async () => {
  // 源 catalog 有 alpha/beta/gamma;globals {"rules":["alpha","beta"]};
  // fakeHome: alpha.md 同源、beta.md 无、gamma 未声明
  const result = await listReport(fakeCtx({ home: fakeHome }), { target: fakeHome, source, global: true })
  const state = (n: string) => result.rows.find((r) => r.name === n)?.state
  expect(state('alpha')).toBe('synced')
  expect(state('beta')).toBe('missing')
  expect(state('gamma')).toBe('uninstalled')
})
```

实现 list.ts:`opts` 增 `global?: boolean`;`ListRow.state` 放宽为 `InstallState | 'differs'`。global 分支替换 `installStateFor` 调用:声明集 = `loadGlobals(source.root)`(null → fail 同文案);broken(源产物缺)优先;声明内按 localText(`join(opts.target, ruleTargetRelPath(name))`)比对 → synced/differs/missing;声明外 → uninstalled。tags/grep 过滤不变。

- [ ] **Step 5: 失败测试 + 实现——项目 status 的 duplicates**

tests/report.test.ts 追加:

```ts
test('project status surfaces duplicates without affecting exit code', async () => {
  // runInit 项目 target;fakeHome 放同名 rule 文件
  const result = await statusReport(fakeCtx({ home: fakeHome }), { source, target })
  expect(result.duplicates).toEqual(['constitution'])
  expect(result.exitCode).toBe(0) // 其余全 synced
})
```

实现 report.ts:`StatusResult` 增 `duplicates?: string[]`;lock 非 null 时对 `Object.keys(lock.rules).toSorted()` 逐个查 `readTextIfExists(join(ctx.home, ruleTargetRelPath(rule)))` 非 null 者入列。exitCode 计算不变。

- [ ] **Step 6: 全量验证 + Commit**

Run: `cd packages/iuse && bun run test && bunx tsc --noEmit && bun run lint`

```bash
git add packages/iuse
git commit -m "feat(iuse): global-scope reconciliation core with duplicate detection"
```

---

### Task 3: CLI 接线——status/diff/list 的 --global、互斥校验、帮助文本

**Files:**
- Modify: `packages/iuse/src/cli/index.ts`
- Test: `packages/iuse/tests/cli.test.ts`(追加;若无该文件则新建,只测导出的纯函数与 defineCommand 的 run 行为,不 spawn)

**Interfaces:**
- Consumes: Task 2 `globalStatusReport`、diff/list 的 `global` 选项
- Produces: 终端命令面(无下游代码消费)

- [ ] **Step 1: 失败测试——互斥与 payload 形状**

tests/cli.test.ts 追加(照文件现有测法;若现有测试直接调 core 函数,则新增对 CLI run 函数的行为测试可通过临时构造 argv 与拦截 console 实现——与文件既有风格保持一致,无既有先例时测 exit 码与输出的最小闭环):

```ts
test('status --global with a target positional is rejected with exit 2', async () => {
  // 调用 status 命令 run({ args: { global: true, target: '/tmp/x', ... } })
  // 断言 process.exitCode === 2 且 stderr 提示互斥
})

test('status --global json payload carries rows and duplicates', async () => {
  // fixture 同 Task 2;断言 renderJson 后的对象含 { ok, rows, duplicates, exitCode }
})
```

- [ ] **Step 2: 实现接线**

- `status`:args 增 `global: { type: 'boolean', description: '对账全局层(~/.claude,即 Claude Code 的 user scope)与中心源;只读,输出建议命令' }`。run 里:`args.global === true && args.target !== undefined` → `console.error('--global 与 target 互斥')`、`process.exitCode = 2`、return。global 路径调 `globalStatusReport(defaultContext(), { source: args.source, projectTarget: process.cwd() })`;文本输出每行 `rule state`,differs/missing 行随后缩进打印 `  建议: <suggestion>`,duplicates 非空时末尾打印 `双层重复(全局与项目都装了,Claude 会加载两遍): <names>`;--json 输出 `{ ok, rows, duplicates, exitCode }`(fail 时 `{ ok, message, exitCode }`)。项目路径:duplicates 非空时文本末尾同款提示行、--json payload 增 duplicates 字段。
- `diff`:args 增同款 `global`;互斥校验相同;global 时 `diffReport(..., { target: join(homedir(), ''), rule, global: true })`——精确写法:`target: homedir()`(core 内用 `join(target, ruleTargetRelPath(rule))`,homedir 即全局 root)。
- `list`:args 增同款 `global`;互斥校验相同;global 时 `listReport(..., { target: homedir(), global: true })`。
- 主命令 description 提及 `--global` scope 一句(中文,注明即 Claude 的 user scope)。

- [ ] **Step 3: 全量验证 + 真机烟测**

Run: `cd packages/iuse && bun run test && bunx tsc --noEmit && bun run lint`
烟测(真源仓、真 home,全部只读):
- `iuse status --global --source ~/code/infra-ai` → markdown 一行(synced 或 differs 视实际),agent-browser 为 unmanaged,退出码与状态一致
- `iuse list --global --source ~/code/infra-ai` → 16 行,markdown 有状态,其余 uninstalled
- `iuse diff --global --rule markdown --source ~/code/infra-ai` → 有差异则 patch,无则 synced
- 烟测前后 `ls -la ~/.claude/rules/` mtime 逐一核对未变

- [ ] **Step 4: Commit**

```bash
git add packages/iuse
git commit -m "feat(iuse): wire --global scope into status, diff and list"
```

---

## 收尾

1. 仓库根 `pnpm meta status` 退 0
2. 三包测试/typecheck/lint 全绿,push 后 `gh run watch` 至 CI 绿
3. 最终 whole-branch review(subagent-driven-development 流程)

## Self-Review 记录

- Spec 覆盖:账(Task 1)、对账语义四态+duplicate(Task 2)、命令面三命令+互斥+建议输出(Task 3)、只读铁律(Global Constraints + 各 task 快照断言)、非目标全部未越界(无 init/update --global、无 local scope、CLAUDE.md 不检测、无全局 lock)
- 类型一致:GlobalState/GlobalRow/GlobalStatusResult 定义于 Task 2、Task 3 消费;RuleDiff.state 与 ListRow.state 的放宽在各自 task 内声明;loadGlobals 契约 Task 1 定义、Task 2 消费
- 已知取舍:duplicate 判定不依赖 globals.json(以「两层文件都实际存在」为准,与 Claude 双加载的真实条件一致);global diff 的声明集用 assembleRules 复用装配与 violation 通路
