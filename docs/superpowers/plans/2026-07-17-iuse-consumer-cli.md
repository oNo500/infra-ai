# iuse 使用端 CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建成 `packages/iuse`（bin `iuse`）：init/status/update 三命令，从 infra-ai 中心源按 profile 拼装配置到目标项目并对账。

**Architecture:** bun + citty 纯命令式 CLI；`src/core/`（纯逻辑，副作用经注入 ctx）+ `src/cli/`；profile/composition/hash 逻辑复用 `@infra-ai/meta-cli/core` barrel（本计划扩展其导出面）。下游账 `.claude/infra-ai.lock.json` 是对账 SSoT。

**Tech Stack:** bun、TypeScript、citty、giget、gray-matter（经 meta-cli 间接）、bun test。

## Global Constraints

- spec：`docs/superpowers/specs/2026-07-17-iuse-consumer-cli-design.md`
- iuse 对中心源只读；拼装为整篇拷贝，无合并无参数化；同一 profile 任何拼装顺序产出逐字节相同结果
- 对账以 rules 内容 hash 为基线本体；版本标识只作溯源（本地 git HEAD / 远程 giget ref）
- 复用 `@infra-ai/meta-cli/core`，不得重复实现 profile/composition/sha256/claude runner
- 禁 `!` 非空断言、禁 `@ts-ignore`、禁双重断言；文件名 kebab-case
- commit message 英文 Conventional Commits
- 每任务结束在 `packages/iuse`（涉及 meta-cli 时两处）跑 `bun test && bunx tsc --noEmit`

---

### Task 1: barrel 扩展 + iuse 包脚手架

**Files:**
- Modify: `packages/meta-cli/src/core/index.ts`（现 7 行）
- Create: `packages/iuse/package.json`、`packages/iuse/tsconfig.json`、`packages/iuse/src/index.ts`、`packages/iuse/src/cli/index.ts`
- Test: `packages/iuse/tests/barrel.test.ts`

**Interfaces:**
- Produces（barrel 新增导出，后续任务全部经 `@infra-ai/meta-cli/core` 消费）：
  `loadProfiles(repoRoot): Profiles`、`loadTagVocabulary(repoRoot): TagVocabulary`、`validateComposition(assets, vocab, profiles): string[]`、`sha256(s: string): string`、`writeFileAtomic(path, content): void`、`runCommand: CommandRunner`、`runClaude`（及类型 `Profile/Profiles/TagVocabulary/CommandRunner/RunResult`）

- [ ] **Step 1: 扩展 barrel**（追加到 packages/meta-cli/src/core/index.ts）

```ts
export { loadProfiles, loadTagVocabulary, validateComposition } from './composition'
export type { Profile, Profiles, TagFacet, TagVocabulary } from './composition'
export { runCommand, sha256, writeFileAtomic } from './io'
export type { CommandRunner } from './io'
export { runClaude } from './claude'
export type { RunResult } from './claude'
```

（若 io.ts 未导出 `CommandRunner` 类型或 claude.ts 未导出 `RunResult`，为其补 `export`——只加导出关键字，不改实现。）

- [ ] **Step 2: 建包**。package.json：

```json
{
  "name": "@infra-ai/iuse",
  "version": "0.0.0",
  "private": true,
  "description": "Consumer CLI: assemble infra-ai profiles into target projects",
  "type": "module",
  "exports": {},
  "bin": { "iuse": "./src/index.ts" },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "oxlint",
    "format": "oxfmt",
    "test": "bun test"
  },
  "dependencies": {
    "@infra-ai/meta-cli": "workspace:*",
    "citty": "^0.2.0",
    "giget": "^2.0.0"
  },
  "devDependencies": {
    "@infra-x/code-quality": "^0.6.2",
    "@infra-x/typescript-config": "^2.0.0",
    "@types/bun": "latest",
    "oxfmt": "^0.55.0",
    "oxlint": "^1.62.0",
    "typescript": "^6.0.3"
  }
}
```

citty/giget 版本以 `packages/meta-cli/package.json` 实际版本为准（照抄）。tsconfig.json 照抄 `packages/meta-cli/tsconfig.json`（include 按本包目录调整）。

`src/index.ts`：

```ts
#!/usr/bin/env bun
import { runCli } from './cli/index'

await runCli()
```

`src/cli/index.ts` 先放空树（Task 5/6 填命令）：

```ts
import { defineCommand, runMain } from 'citty'

export function buildMainCommand() {
  return defineCommand({
    meta: { name: 'iuse', description: 'assemble infra-ai profiles into target projects' },
    subCommands: {},
  })
}

export async function runCli(): Promise<void> {
  await runMain(buildMainCommand())
}
```

- [ ] **Step 3: 写冒烟测试**（tests/barrel.test.ts）

```ts
import { expect, test } from 'bun:test'
import { loadProfiles, sha256, validateComposition } from '@infra-ai/meta-cli/core'

test('barrel exposes composition and io surface', () => {
  expect(typeof loadProfiles).toBe('function')
  expect(typeof validateComposition).toBe('function')
  expect(sha256('a')).toHaveLength(64)
})
```

- [ ] **Step 4: 安装与验证**

Run: `pnpm install`（仓库根），然后 `cd packages/iuse && bun test && bunx tsc --noEmit`；`cd packages/meta-cli && bun test && bunx tsc --noEmit`
Expected: 全 PASS（meta-cli 既有 130+ 测试不受影响）

- [ ] **Step 5: Commit**

```bash
git add packages/meta-cli/src/core packages/iuse pnpm-lock.yaml
git commit -m "feat(iuse): scaffold package, extend meta-cli core barrel"
```

### Task 2: 中心源解析（core/source.ts）

**Files:**
- Create: `packages/iuse/src/core/source.ts`
- Test: `packages/iuse/tests/source.test.ts`

**Interfaces:**
- Consumes: `readTextIfExists`（barrel）；注入 `download: (input: string, opts: { dir: string; forceClean?: boolean }) => Promise<unknown>`、`run: CommandRunner`
- Produces:
  - `interface SourceRef { root: string; version: { type: 'local' | 'remote'; id: string }; locator: string }`
  - `resolveSource(opts: { explicit?: string; envRoot?: string; homeDefault: string; cacheDir: string; download; run }): Promise<SourceRef>`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveSource } from '../src/core/source'

function localSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-src-'))
  writeFileSync(join(dir, 'profiles.json'), '{}')
  return dir
}

const fakeRun = (stdout: string, code = 0) => async () => ({ code, stdout, stderr: '' })

describe('resolveSource', () => {
  test('explicit local path wins and records git HEAD', async () => {
    const dir = localSource()
    const ref = await resolveSource({
      explicit: dir, envRoot: '/nope', homeDefault: '/nope2', cacheDir: '/tmp',
      download: async () => ({}), run: fakeRun('abc123\n'),
    })
    expect(ref.root).toBe(dir)
    expect(ref.version).toEqual({ type: 'local', id: 'abc123' })
  })
  test('dirty worktree appends -dirty', async () => {
    const dir = localSource()
    let call = 0
    const run = async () => {
      call += 1
      return call === 1 ? { code: 0, stdout: 'abc123\n', stderr: '' } : { code: 0, stdout: ' M x\n', stderr: '' }
    }
    const ref = await resolveSource({ explicit: dir, homeDefault: '/n', cacheDir: '/t', download: async () => ({}), run })
    expect(ref.version.id).toBe('abc123-dirty')
  })
  test('missing profiles.json rejects local path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'iuse-bad-'))
    await expect(resolveSource({ explicit: dir, homeDefault: '/n', cacheDir: '/t', download: async () => ({}), run: fakeRun('') }))
      .rejects.toThrow('profiles.json not found')
  })
  test('gh: source downloads snapshot and records ref', async () => {
    const cache = mkdtempSync(join(tmpdir(), 'iuse-cache-'))
    const download = async (_input: string, opts: { dir: string }) => {
      mkdirSync(opts.dir, { recursive: true })
      writeFileSync(join(opts.dir, 'profiles.json'), '{}')
      return {}
    }
    const ref = await resolveSource({ explicit: 'gh:owner/repo#v2', homeDefault: '/n', cacheDir: cache, download, run: fakeRun('') })
    expect(ref.version).toEqual({ type: 'remote', id: 'v2' })
    expect(ref.root.startsWith(cache)).toBe(true)
  })
  test('env fallback then home default', async () => {
    const dir = localSource()
    const ref = await resolveSource({ envRoot: dir, homeDefault: '/nope', cacheDir: '/t', download: async () => ({}), run: fakeRun('h\n') })
    expect(ref.root).toBe(dir)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现**

```ts
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { CommandRunner } from '@infra-ai/meta-cli/core'

export interface SourceRef {
  root: string
  version: { type: 'local' | 'remote'; id: string }
  locator: string
}

type DownloadFn = (input: string, opts: { dir: string; forceClean?: boolean }) => Promise<unknown>

function assertSourceRoot(root: string, locator: string): void {
  if (!existsSync(join(root, 'profiles.json'))) {
    throw new Error(`profiles.json not found in source '${locator}' -- not an infra-ai source`)
  }
}

async function localRef(root: string, locator: string, run: CommandRunner): Promise<SourceRef> {
  assertSourceRoot(root, locator)
  const head = await run('git', ['rev-parse', 'HEAD'], { cwd: root })
  let id = head.code === 0 ? head.stdout.trim() : 'no-git'
  if (head.code === 0) {
    const porcelain = await run('git', ['status', '--porcelain'], { cwd: root })
    if (porcelain.code === 0 && porcelain.stdout.trim() !== '') id = `${id}-dirty`
  }
  return { root, version: { type: 'local', id }, locator }
}

async function remoteRef(locator: string, cacheDir: string, download: DownloadFn): Promise<SourceRef> {
  const refPart = locator.includes('#') ? locator.slice(locator.indexOf('#') + 1) : 'main'
  const safe = locator.replaceAll(/[^A-Za-z0-9._-]/gu, '-')
  const dir = join(cacheDir, safe)
  await download(locator, { dir, forceClean: true })
  assertSourceRoot(dir, locator)
  return { root: dir, version: { type: 'remote', id: refPart }, locator }
}

export async function resolveSource(opts: {
  explicit?: string
  envRoot?: string
  homeDefault: string
  cacheDir: string
  download: DownloadFn
  run: CommandRunner
}): Promise<SourceRef> {
  const candidate = opts.explicit ?? opts.envRoot ?? opts.homeDefault
  if (candidate.startsWith('gh:')) return remoteRef(candidate, opts.cacheDir, opts.download)
  return localRef(candidate, candidate, opts.run)
}
```

- [ ] **Step 4: 全量验证**（bun test + tsc）
- [ ] **Step 5: Commit** `feat(iuse): source resolution chain with local git id and remote snapshot`

### Task 3: 下游账与三态对账（core/manifest.ts）

**Files:**
- Create: `packages/iuse/src/core/manifest.ts`
- Test: `packages/iuse/tests/manifest.test.ts`

**Interfaces:**
- Consumes: `readTextIfExists`、`writeFileAtomic`（barrel）
- Produces:
  - `interface DownstreamLock { source: { type: 'local' | 'remote'; id: string; locator: string }; profile: string; appliedAt: string; rules: Record<string, string>; templates: string[] }`
  - `LOCK_PATH = '.claude/infra-ai.lock.json'`
  - `loadDownstreamLock(targetRoot: string): DownstreamLock | null`（缺文件 null，坏 JSON 抛带路径错误）
  - `saveDownstreamLock(targetRoot: string, lock: DownstreamLock): void`
  - `type DriftState = 'synced' | 'modified' | 'outdated' | 'missing'`
  - `computeDrift(localHash: string | null, baselineHash: string, sourceHash: string | null): DriftState`

- [ ] **Step 1: 写失败测试**（含 drift 真值全覆盖）

```ts
import { describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { computeDrift, loadDownstreamLock, saveDownstreamLock } from '../src/core/manifest'

describe('computeDrift', () => {
  test('all equal -> synced', () => expect(computeDrift('a', 'a', 'a')).toBe('synced'))
  test('local differs from baseline -> modified (regardless of source)', () => {
    expect(computeDrift('x', 'a', 'a')).toBe('modified')
    expect(computeDrift('x', 'a', 'b')).toBe('modified')
  })
  test('local matches baseline, source moved -> outdated', () => expect(computeDrift('a', 'a', 'b')).toBe('outdated'))
  test('source retired the rule -> outdated', () => expect(computeDrift('a', 'a', null)).toBe('outdated'))
  test('local copy deleted -> missing', () => expect(computeDrift(null, 'a', 'a')).toBe('missing'))
})

test('lock roundtrip and null on absence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-lock-'))
  expect(loadDownstreamLock(dir)).toBeNull()
  const lock = {
    source: { type: 'local' as const, id: 'abc', locator: '/src' },
    profile: 'python-cli', appliedAt: '2026-07-17T00:00:00Z',
    rules: { constitution: 'h1' }, templates: ['architecture', 'claude-md'],
  }
  saveDownstreamLock(dir, lock)
  expect(loadDownstreamLock(dir)).toEqual(lock)
})
```

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现**

```ts
import { join } from 'node:path'
import { readTextIfExists, writeFileAtomic } from '@infra-ai/meta-cli/core'

export const LOCK_PATH = '.claude/infra-ai.lock.json'

export interface DownstreamLock {
  source: { type: 'local' | 'remote'; id: string; locator: string }
  profile: string
  appliedAt: string
  rules: Record<string, string>
  templates: string[]
}

export function loadDownstreamLock(targetRoot: string): DownstreamLock | null {
  const raw = readTextIfExists(join(targetRoot, LOCK_PATH))
  if (raw === null) return null
  try {
    return JSON.parse(raw) as DownstreamLock
  } catch (error) {
    throw new Error(`${LOCK_PATH}: invalid JSON (${String(error)})`)
  }
}

export function saveDownstreamLock(targetRoot: string, lock: DownstreamLock): void {
  writeFileAtomic(join(targetRoot, LOCK_PATH), `${JSON.stringify(lock, null, 2)}\n`)
}

export type DriftState = 'synced' | 'modified' | 'outdated' | 'missing'

export function computeDrift(
  localHash: string | null,
  baselineHash: string,
  sourceHash: string | null,
): DriftState {
  if (localHash === null) return 'missing'
  if (localHash !== baselineHash) return 'modified'
  if (sourceHash === null || sourceHash !== baselineHash) return 'outdated'
  return 'synced'
}
```

- [ ] **Step 4: 全量验证**
- [ ] **Step 5: Commit** `feat(iuse): downstream lock and three-state drift`

### Task 4: 拼装计划（core/assemble.ts）

**Files:**
- Create: `packages/iuse/src/core/assemble.ts`
- Test: `packages/iuse/tests/assemble.test.ts`

**Interfaces:**
- Consumes: `discoverAssets`、`loadProfiles`、`loadTagVocabulary`、`validateComposition`、`readTextIfExists`、`sha256`（barrel）；Task 2 的 `SourceRef`
- Produces:
  - `interface AssemblyItem { rule: string; sourcePath: string; targetRelPath: string; content: string; hash: string }`
  - `planAssembly(sourceRoot: string, profileName: string): { items: AssemblyItem[]; violations: string[] }`——profile 不存在抛错并列出可用名；rule 产物缺失计入 violations；items 按 rule 名排序（顺序无关的规范序）

- [ ] **Step 1: 写失败测试**（temp 源 fixture：profiles.json + meta/tags.json + meta/rules/*.md + rules/global|scoped/*.md，覆盖：正常计划、profile 未知、产物缺失、composition 违规传导）

```ts
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { planAssembly } from '../src/core/assemble'

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-asm-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  mkdirSync(join(dir, 'rules', 'global'), { recursive: true })
  mkdirSync(join(dir, 'rules', 'scoped'), { recursive: true })
  writeFileSync(join(dir, 'meta', 'tags.json'), JSON.stringify({ concern: { exclusive: false, values: { core: 'x', docs: 'x' } } }))
  writeFileSync(join(dir, 'meta', 'rules', 'constitution.md'), '---\nname: constitution\nstatus: ready\nscope: global\ntags: [core]\n---\nbody')
  writeFileSync(join(dir, 'meta', 'rules', 'markdown.md'), '---\nname: markdown\nstatus: ready\nscope: "**/*.md"\ntags: [docs]\n---\nbody')
  writeFileSync(join(dir, 'rules', 'global', 'constitution.md'), '# Constitution\n')
  writeFileSync(join(dir, 'rules', 'scoped', 'markdown.md'), '---\npaths:\n  - "**/*.md"\n---\n# Markdown\n')
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution', 'markdown'] } }))
  return dir
}

describe('planAssembly', () => {
  test('produces sorted copy plan with hashes', () => {
    const src = fixtureSource()
    const { items, violations } = planAssembly(src, 'demo')
    expect(violations).toEqual([])
    expect(items.map((i) => i.rule)).toEqual(['constitution', 'markdown'])
    expect(items[0]?.targetRelPath).toBe('.claude/rules/constitution.md')
    expect(items[0]?.hash).toHaveLength(64)
  })
  test('unknown profile throws with available names', () => {
    const src = fixtureSource()
    expect(() => planAssembly(src, 'nope')).toThrow("unknown profile 'nope' (available: demo)")
  })
  test('missing built artifact becomes a violation', () => {
    const src = fixtureSource()
    writeFileSync(join(src, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution', 'markdown', 'ghost'] } }))
    const { violations } = planAssembly(src, 'demo')
    expect(violations.some((v) => v.includes('ghost'))).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现**

```ts
import { join } from 'node:path'
import {
  discoverAssets, loadProfiles, loadTagVocabulary, readTextIfExists, sha256, validateComposition,
} from '@infra-ai/meta-cli/core'

export interface AssemblyItem {
  rule: string
  sourcePath: string
  targetRelPath: string
  content: string
  hash: string
}

export function planAssembly(
  sourceRoot: string,
  profileName: string,
): { items: AssemblyItem[]; violations: string[] } {
  const profiles = loadProfiles(sourceRoot)
  const profile = profiles[profileName]
  if (profile === undefined) {
    throw new Error(`unknown profile '${profileName}' (available: ${Object.keys(profiles).toSorted().join(', ')})`)
  }
  const assets = discoverAssets(sourceRoot)
  const violations = validateComposition(assets, loadTagVocabulary(sourceRoot), profiles)
  const byName = new Map(assets.filter((a) => a.kind === 'rule').map((a) => [a.name, a]))
  const items: AssemblyItem[] = []
  for (const rule of [...profile.rules].toSorted()) {
    const asset = byName.get(rule)
    if (asset === undefined) continue // validateComposition 已计入 violations
    const sourcePath = join(sourceRoot, asset.artifactPath)
    const content = readTextIfExists(sourcePath)
    if (content === null) {
      violations.push(`${rule}: built artifact missing at ${asset.artifactPath} (run imeta build in the source)`)
      continue
    }
    items.push({ rule, sourcePath, targetRelPath: `.claude/rules/${rule}.md`, content, hash: sha256(content) })
  }
  return { items, violations }
}
```

- [ ] **Step 4: 全量验证**
- [ ] **Step 5: Commit** `feat(iuse): assembly planning over profiles with composition gate`

### Task 5: init 命令 + 实例化契约

**Files:**
- Create: `meta/prompts/template-instantiate.md`、`packages/iuse/src/core/init.ts`
- Modify: `packages/iuse/src/cli/index.ts`
- Test: `packages/iuse/tests/init.test.ts`

**Interfaces:**
- Consumes: Task 2-4 全部；`runClaude`（barrel，经 ctx 注入 fake）
- Produces:
  - `interface IuseContext { download; run: CommandRunner; claude: typeof runClaude; now: () => string; env: Record<string, string | undefined>; home: string; cacheDir: string }`
  - `runInit(ctx: IuseContext, opts: { source?: string; profile: string; target: string; force: boolean }): Promise<{ ok: boolean; message: string }>`

- [ ] **Step 1: 写实例化契约** `meta/prompts/template-instantiate.md`（AI-only，禁流程词红线同样适用）：

```markdown
# 模板实例化

你在把中心源模板实例化到目标项目：输入是任务指令给出的模板文件与目标
路径。读完本文件、模板与目标项目后再动笔。

## 步骤

1. 读模板：骨架、`[ALL_CAPS]` 占位符、填空规则
2. 读目标项目事实：package.json（名称、scripts、依赖）、目录结构、
   lockfile 与 workspace 配置——占位符的值只来自项目事实，不臆造
3. 按模板自带的填空规则逐个替换占位符；项目里没有对应事实的可选章节
   整节删除，不留空标题
4. 只写任务指令指定的目标文件，不修改其他文件，不提交

## 写法要求

- 产出不得残留任何 `[ALL_CAPS]` 占位符与模板注释
- CLAUDE.md 入口保持 50 行以内；架构文档按模板骨架的章节顺序
- 正文以中文为主；术语、命令、代码与标识保留英文
```

- [ ] **Step 2: 写失败测试**（fake claude 落文件；断言：rules 拷贝、settings 拷贝、CLAUDE.md/architecture 生成、下游账内容、已有账未加 --force 报错、violations 拒绝、[ALL_CAPS] 残留报错）

```ts
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInit } from '../src/core/init'
import { loadDownstreamLock } from '../src/core/manifest'

// fixtureSource(): 复用 Task 4 测试的构造，另加 templates/settings.json、
// templates/architecture.md（含 [PROJECT_NAME]）、templates/claude-md.md（含 [PROJECT_NAME]）
// fakeClaude: 按 prompt 中的目标路径写出不含占位符、<50 行的文件后返回 { code: 0, timedOut: false, stderr: '' }

function ctxWith(claude: unknown) {
  return {
    download: async () => ({}),
    run: async () => ({ code: 0, stdout: 'head1\n', stderr: '' }),
    claude, now: () => '2026-07-17T00:00:00Z',
    env: {}, home: '/nope', cacheDir: '/tmp/iuse-cache',
  }
}

describe('runInit', () => {
  test('assembles rules, copies settings, instantiates templates, writes lock', async () => { /* 按上述断言展开 */ })
  test('existing lock without --force fails pointing at update', async () => { /* ... */ })
  test('composition violations refuse init', async () => { /* ... */ })
  test('leftover [ALL_CAPS] after instantiation fails', async () => { /* fakeClaude 故意留占位符 */ })
})
```

（测试主体由实现者按断言清单展开；fixture 与 fake 的形态如注释所示，全部经 ctx 注入，不 mock 模块。）

- [ ] **Step 3: 实现 runInit**（要点，完整实现由实现者按此展开）：

```ts
// 1. resolveSource({ explicit: opts.source, envRoot: ctx.env.INFRA_AI_ROOT,
//    homeDefault: join(ctx.home, 'code/infra-ai'), cacheDir: ctx.cacheDir, download, run })
// 2. loadDownstreamLock(target) 非 null 且 !force -> fail 提示 iuse update / --force
// 3. planAssembly(source.root, profile)；violations 非空 -> fail 列明细
// 4. 逐 item writeFileAtomic(join(target, targetRelPath), content)（force 下同内容跳过）
// 5. 拷 templates/settings.json -> .claude/settings.json（已存在且 !force 跳过并提示）
// 6. AI 实例化 x2（architecture -> .claude/rules/architecture.md；claude-md -> CLAUDE.md，最后生成）：
//    prompt 指针引用 join(source.root, 'meta/prompts/template-instantiate.md') + 模板路径 + 目标绝对路径
//    allowedTools: `Read,Glob,Grep,Write(${targetFile})`（每次一个目标文件）
//    产物已存在且 !force -> 跳过（幂等）
// 7. 实例化后校验：/\[[A-Z][A-Z0-9_]*\]/u 无残留；CLAUDE.md 行数 < 50
//    claude 退出非零/超时/校验失败 -> fail（已拷贝的 rules 保留有效），
//    消息提示用 --force 重跑补实例化
// 8. saveDownstreamLock：source{type,id,locator}、profile、appliedAt: ctx.now()、
//    rules: Object.fromEntries(items.map(i => [i.rule, i.hash]))、templates: ['architecture','claude-md']
```

cli/index.ts 挂 `init` 子命令：args `profile`（string，必填）、`source`（string 可选）、`force`（boolean）、positional `target`（缺省 `process.cwd()`）；defaultContext 用真实 giget `downloadTemplate`、`runCommand`、`runClaude`、`homedir()`、cacheDir `join(homedir(), '.cache/iuse')`。

- [ ] **Step 4: 全量验证**（iuse 包 bun test + tsc；meta-cli 的 tests/prompts.test.ts 会自动覆盖新契约文件的流程词红线——在 packages/meta-cli 跑一次 bun test）
- [ ] **Step 5: Commit** `feat(iuse): init command with AI template instantiation`

### Task 6: status 与 update 命令

**Files:**
- Create: `packages/iuse/src/core/report.ts`、`packages/iuse/src/core/update.ts`
- Modify: `packages/iuse/src/cli/index.ts`
- Test: `packages/iuse/tests/report.test.ts`、`packages/iuse/tests/update.test.ts`

**Interfaces:**
- Consumes: Task 2-5 全部
- Produces:
  - `statusReport(ctx, opts: { source?: string; target: string }): Promise<{ rows: { rule: string; state: DriftState }[]; exitCode: number }>`——无下游账时 fail；rows 按 rule 名排序；有 modified/outdated/missing 时 exitCode 1
  - `runUpdate(ctx, opts: { source?: string; target: string; force: boolean }): Promise<{ ok: boolean; message: string }>`——outdated 应用新版并更新账（含 source.id 与 appliedAt 刷新）；modified/missing 默认跳过警告、force 覆盖；profile 在源里新增的 rule 一并拷入并登记、被移除的 rule 报告但不删除本地副本（提示人工处理）

- [ ] **Step 1: 写失败测试**（fixture：先 runInit 到 temp target，然后分别改本地副本 / 改源产物 / 删本地副本，断言三态与 update 行为、exit code、modified+force 覆盖、账刷新）
- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现**（statusReport 对每个账内 rule 取 localHash=sha256(目标副本)、baselineHash=账、sourceHash=planAssembly 结果映射；update 按 drift 分支处理）
- [ ] **Step 4: 全量验证**
- [ ] **Step 5: Commit** `feat(iuse): status drift report and update command`

### Task 7: 真实冒烟 + 文档同步 + 退役（控制器 inline）

**Files:**
- Delete: `scripts/init-project.sh`
- Modify: `.claude/rules/architecture.md`（结构树加 packages/iuse，scripts 行删除）、`.claude/CLAUDE.md`（命令节加 iuse 一行）、`meta/README.md` 如有提及

- [ ] **Step 1: 全局 link**：`cd packages/iuse && pnpm link --global`，确认 `iuse --help` 出三命令
- [ ] **Step 2: 真实冒烟**：临时目录建最小 node 项目（package.json 带 name/scripts），跑 `iuse init --profile python-cli <dir>`（真 claude 实例化）；验证 `.claude/rules/` 六文件 + CLAUDE.md <50 行无占位符 + 下游账；改一条 rule 副本跑 `iuse status`（modified，退 1）；`iuse update` 跳过并警告；`--force` 覆盖后 status 全 synced 退 0
- [ ] **Step 3: 文档同步与退役**：`git rm scripts/init-project.sh`；architecture.md/CLAUDE.md 更新
- [ ] **Step 4: 全仓验证**：三包 bun test + tsc + lint 全绿
- [ ] **Step 5: Commit** `feat(iuse): real smoke, docs sync, retire init-project.sh`
