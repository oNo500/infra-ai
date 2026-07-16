# rule 原子化与组合元数据 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** rule 元指令获得 tags/requires 元数据、受控词表与 profile 账及其校验，并按 spec 把 rule 拆到最小可组合单元。

**Architecture:** meta-cli 侧四个代码任务（frontmatter 解析、hash 排除管理字段 + lock 迁移、composition 校验模块、status 集成与 --tag）；随后两个内容任务（拆分元指令、构建收敛 + profile seed）由控制器 inline 执行——构建 spawn headless claude，期间仓库必须静默（改动集守卫），不适合并行 subagent。

**Tech Stack:** bun + TypeScript（packages/meta-cli），gray-matter，bun test。

## Global Constraints

- spec：`docs/superpowers/specs/2026-07-15-rule-composition-design.md`
- lock 基线的元指令 hash 只算正文 + name/status/scope，排除 tags/requires
- 词表分面化：facet 声明 exclusive，互斥面内一条 rule 至多一个值；跨面 tag 不重名；零引用孤儿 tag 报违规
- profile 校验三条：rule 名存在、requires 闭包满足、constitution 必含
- 不新增 action，registry/keymap 不动（parity 红线：`tests/parity.test.ts` 必须保持通过）
- writeback frontmatter 冻结不豁免 tags/requires（无代码变更）
- 禁 `!` 非空断言、禁 `@ts-ignore`、禁双重断言；文件名 kebab-case
- commit message 英文 Conventional Commits
- 每个任务结束跑 `cd packages/meta-cli && bun test && bunx tsc --noEmit`

---

### Task 1: 元指令 frontmatter 解析 tags/requires

**Files:**
- Modify: `packages/meta-cli/src/core/meta.ts`（MetaAsset 接口 + parseMetaFile）
- Test: `packages/meta-cli/tests/meta.test.ts`

**Interfaces:**
- Consumes: 现有 `parseMetaFile(content, filename, kind): MetaAsset`
- Produces: `MetaAsset` 新增 `tags: string[]` 与 `requires: string[]`（缺省 `[]`）；后续任务按名引用

- [ ] **Step 1: 写失败测试**（追加到 tests/meta.test.ts）

```ts
test('parses tags and requires arrays from frontmatter', () => {
  const content = `---\nname: react\nstatus: ready\nscope: "**/*.tsx"\ntags: [ts, frontend]\nrequires: [typescript]\n---\nbody`
  const asset = parseMetaFile(content, 'react.md', 'rule')
  expect(asset.tags).toEqual(['ts', 'frontend'])
  expect(asset.requires).toEqual(['typescript'])
})

test('defaults tags and requires to empty arrays', () => {
  const content = `---\nname: python\nstatus: stub\n---\n`
  const asset = parseMetaFile(content, 'python.md', 'rule')
  expect(asset.tags).toEqual([])
  expect(asset.requires).toEqual([])
})

test('drops non-string entries in tags and requires', () => {
  const content = `---\nname: x\nstatus: ready\ntags: [ok, 3]\nrequires: 5\n---\n`
  const asset = parseMetaFile(content, 'x.md', 'rule')
  expect(asset.tags).toEqual(['ok'])
  expect(asset.requires).toEqual([])
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/meta-cli && bun test tests/meta.test.ts`
Expected: FAIL（`tags` 属性不存在 / undefined）

- [ ] **Step 3: 实现**

`MetaAsset` 接口加两个字段；`parseMetaFile` 的 return 前加解析：

```ts
export interface MetaAsset {
  name: string
  kind: AssetKind
  status: MetaStatus
  scope: string | null
  tags: string[]
  requires: string[]
  metaPath: string
  artifactPath: string
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}
```

return 对象中加 `tags: stringArray(data.tags)` 与 `requires: stringArray(data.requires)`。

- [ ] **Step 4: 全量验证**

Run: `cd packages/meta-cli && bun test && bunx tsc --noEmit`
Expected: PASS（其余构造 MetaAsset 字面量的测试若因缺字段编译失败，为其补 `tags: [], requires: []`）

- [ ] **Step 5: Commit**

```bash
git add packages/meta-cli
git commit -m "feat(meta-cli): parse tags and requires from rule meta frontmatter"
```

### Task 2: hash 排除管理字段 + lock 迁移

**Files:**
- Modify: `packages/meta-cli/src/core/meta.ts`（新增 metaContentHash）
- Modify: `packages/meta-cli/src/core/status.ts:33`（gatherFacts 的 metaHash）
- Modify: `packages/meta-cli/src/core/claude.ts:141-148`（recordBuild 的 metaHash）
- Modify: `artifacts.lock.json`（迁移脚本重算）
- Test: `packages/meta-cli/tests/meta.test.ts`

**Interfaces:**
- Produces: `metaContentHash(content: string): string`（meta.ts 导出）——语义：`sha256(JSON.stringify({name, status, scope}) + '\n' + body)`，tags/requires 与其余 frontmatter 字段不参与

- [ ] **Step 1: 写失败测试**

```ts
import { metaContentHash } from '../src/core/meta'

test('metaContentHash ignores tags and requires', () => {
  const base = `---\nname: a\nstatus: ready\nscope: global\n---\nbody`
  const tagged = `---\nname: a\nstatus: ready\nscope: global\ntags: [ts]\nrequires: [b]\n---\nbody`
  expect(metaContentHash(tagged)).toBe(metaContentHash(base))
})

test('metaContentHash changes with body and with scope', () => {
  const a = `---\nname: a\nstatus: ready\nscope: global\n---\nbody`
  expect(metaContentHash(`---\nname: a\nstatus: ready\nscope: global\n---\nother`)).not.toBe(metaContentHash(a))
  expect(metaContentHash(`---\nname: a\nstatus: ready\nscope: "**/*.ts"\n---\nbody`)).not.toBe(metaContentHash(a))
})
```

- [ ] **Step 2: 跑测试确认失败**（metaContentHash 未导出）

- [ ] **Step 3: 实现 metaContentHash 并切换两处调用点**

meta.ts（`import { sha256 } from './io'`）：

```ts
export function metaContentHash(content: string): string {
  const { data, content: body } = matter(content)
  const kept = {
    name: typeof data.name === 'string' ? data.name : null,
    status: data.status === 'ready' ? 'ready' : 'stub',
    scope: typeof data.scope === 'string' ? data.scope : null,
  }
  return sha256(`${JSON.stringify(kept)}\n${body}`)
}
```

status.ts gatherFacts：`metaHash: metaContentHash(metaContent)`（import 自 './meta'，移除未用的 sha256 import 如适用）。
claude.ts recordBuild：`metaHash: metaContentHash(metaContent)`。

- [ ] **Step 4: 全量测试 + typecheck**（现有 status/claude 测试若断言旧 hash 值需同步改为 metaContentHash 计算值）

- [ ] **Step 5: lock 迁移**（hash 语义变了，旧基线全部失配；产物没变，机械重算即可，不跑 claude）

写入 `/private/tmp/claude-501/-Users-xiu-code-infra-ai/689c4d96-c08d-4978-b126-d8ac7f945634/scratchpad/recompute-lock.ts`：

```ts
import { join } from 'node:path'
import { discoverAssets, metaContentHash } from '/Users/xiu/code/infra-ai/packages/meta-cli/src/core/meta'
import { readTextIfExists } from '/Users/xiu/code/infra-ai/packages/meta-cli/src/core/io'
import { loadLock, saveLock } from '/Users/xiu/code/infra-ai/packages/meta-cli/src/core/registry'
import { lockKey } from '/Users/xiu/code/infra-ai/packages/meta-cli/src/core/status'

const repoRoot = '/Users/xiu/code/infra-ai'
const lock = loadLock(repoRoot)
for (const asset of discoverAssets(repoRoot)) {
  const entry = lock[lockKey(asset)]
  if (!entry) continue
  entry.metaHash = metaContentHash(readTextIfExists(join(repoRoot, asset.metaPath)) ?? '')
}
saveLock(repoRoot, lock)
console.log('lock migrated')
```

Run: `bun <scratchpad>/recompute-lock.ts && imeta status`
Expected: 全部 synced（python 为 stub 时期已 ready+synced；若有 stub 行为 stub），退出码 0

- [ ] **Step 6: Commit**

```bash
git add packages/meta-cli artifacts.lock.json
git commit -m "feat(meta-cli): exclude management frontmatter from meta hash, migrate lock"
```

### Task 3: composition 模块（词表 / requires / profile 校验）

**Files:**
- Create: `packages/meta-cli/src/core/composition.ts`
- Test: `packages/meta-cli/tests/composition.test.ts`

**Interfaces:**
- Consumes: `MetaAsset`（含 Task 1 的 tags/requires）、`RegistryError`（registry.ts）、`readTextIfExists`（io.ts）
- Produces:
  - `TagFacet = { exclusive: boolean; values: Record<string, string> }`；`TagVocabulary = Record<string, TagFacet>`（facet 名 → 定义）
  - `loadTagVocabulary(repoRoot: string): TagVocabulary`（文件缺失返回 `{}`；校验结构 + 跨面 tag 不重名）
  - `loadProfiles(repoRoot: string): Profiles`（`Record<string, {description?: string; rules: string[]}>`，文件缺失返回 `{}`）
  - `facetOf(vocab: TagVocabulary, tag: string): string | null`
  - `validateComposition(assets: MetaAsset[], vocab: TagVocabulary, profiles: Profiles): string[]`（含互斥面与孤儿 tag 校验）

- [ ] **Step 1: 写失败测试**（用内存构造的 MetaAsset fixture；文件加载用 temp 目录）

```ts
import { describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProfiles, loadTagVocabulary, validateComposition } from '../src/core/composition'
import type { MetaAsset } from '../src/core/meta'

function rule(name: string, tags: string[], requires: string[] = [], status: 'ready' | 'stub' = 'ready'): MetaAsset {
  return { name, kind: 'rule', status, scope: 'global', tags, requires, metaPath: `meta/rules/${name}.md`, artifactPath: `rules/global/${name}.md` }
}

const VOCAB = {
  lang: { exclusive: true, values: { ts: 'x', python: 'x' } },
  concern: { exclusive: false, values: { core: 'x', docs: 'x' } },
}

describe('validateComposition', () => {
  test('accepts a clean setup', () => {
    const assets = [
      rule('constitution', ['core']),
      rule('typescript', ['ts']),
      rule('markdown', ['docs']),
      rule('python-rule', ['python']),
      rule('react', ['ts'], ['typescript']),
    ]
    const profiles = { app: { rules: ['constitution', 'typescript', 'react'] } }
    expect(validateComposition(assets, VOCAB, profiles)).toEqual([])
  })
  test('flags unknown tag, missing tags on ready rule, dangling requires', () => {
    const assets = [rule('constitution', ['nope', 'core']), rule('typescript', []), rule('react', ['ts', 'docs'], ['ghost']), rule('py', ['python'])]
    const v = validateComposition(assets, VOCAB, {})
    expect(v).toContain("constitution: unknown tag 'nope' (not in meta/tags.json)")
    expect(v).toContain('typescript: ready rule must declare tags')
    expect(v).toContain("react: requires unknown rule 'ghost'")
  })
  test('flags two tags from the same exclusive facet', () => {
    const assets = [rule('a', ['ts', 'python', 'core']), rule('b', ['docs'])]
    const v = validateComposition(assets, VOCAB, {})
    expect(v).toContain("a: tags 'ts' and 'python' are mutually exclusive within facet 'lang'")
  })
  test('flags orphan vocabulary tags', () => {
    const assets = [rule('a', ['ts', 'core']), rule('b', ['docs'])]
    const v = validateComposition(assets, VOCAB, {})
    expect(v).toContain("orphan tag 'python' in meta/tags.json: no rule uses it")
  })
  test('stub rule may omit tags', () => {
    // 孤儿校验在本用例里会报词表项，只断言无 stub 相关违规
    const v = validateComposition([rule('python-note', [], [], 'stub')], VOCAB, {})
    expect(v.filter((m) => m.startsWith('python-note:'))).toEqual([])
  })
  test('flags profile violations: unknown rule, unmet requires, missing constitution', () => {
    const assets = [rule('constitution', ['core']), rule('typescript', ['ts']), rule('markdown', ['docs']), rule('py', ['python']), rule('react', ['ts'], ['typescript'])]
    const v = validateComposition(assets, VOCAB, { bad: { rules: ['react', 'ghost'] } })
    expect(v).toContain("profile bad: unknown rule 'ghost'")
    expect(v).toContain("profile bad: 'react' requires 'typescript' which is not in the profile")
    expect(v).toContain('profile bad: missing constitution')
  })
})

describe('loaders', () => {
  test('missing files load as empty', () => {
    const dir = mkdtempSync(join(tmpdir(), 'comp-'))
    expect(loadTagVocabulary(dir)).toEqual({})
    expect(loadProfiles(dir)).toEqual({})
  })
  test('malformed profiles throw RegistryError with file and field', () => {
    const dir = mkdtempSync(join(tmpdir(), 'comp-'))
    writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ app: { rules: 'not-array' } }))
    expect(() => loadProfiles(dir)).toThrow("profiles.json: profile 'app' must carry a string[] rules field")
  })
  test('malformed vocabulary throws RegistryError', () => {
    const dir = mkdtempSync(join(tmpdir(), 'comp-'))
    mkdirSync(join(dir, 'meta'))
    writeFileSync(join(dir, 'meta', 'tags.json'), JSON.stringify({ lang: { values: { ts: 'x' } } }))
    expect(() => loadTagVocabulary(dir)).toThrow("meta/tags.json: facet 'lang' must carry boolean exclusive and a values object")
  })
  test('duplicate tag across facets throws RegistryError', () => {
    const dir = mkdtempSync(join(tmpdir(), 'comp-'))
    mkdirSync(join(dir, 'meta'))
    writeFileSync(join(dir, 'meta', 'tags.json'), JSON.stringify({
      lang: { exclusive: true, values: { ts: 'x' } },
      concern: { exclusive: false, values: { ts: 'y' } },
    }))
    expect(() => loadTagVocabulary(dir)).toThrow("meta/tags.json: tag 'ts' appears in more than one facet")
  })
})
```

- [ ] **Step 2: 跑测试确认失败**（模块不存在）

- [ ] **Step 3: 实现 composition.ts**

```ts
import { join } from 'node:path'
import { readTextIfExists } from './io'
import type { MetaAsset } from './meta'
import { RegistryError } from './registry'

export interface TagFacet {
  exclusive: boolean
  values: Record<string, string>
}

export type TagVocabulary = Record<string, TagFacet>

export interface Profile {
  description?: string
  rules: string[]
}

export type Profiles = Record<string, Profile>

function parseJson(repoRoot: string, filename: string): unknown {
  const raw = readTextIfExists(join(repoRoot, filename))
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new RegistryError(`${filename}: invalid JSON (${String(error)})`)
  }
}

export function loadTagVocabulary(repoRoot: string): TagVocabulary {
  const raw = parseJson(repoRoot, 'meta/tags.json')
  if (raw === null) return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new RegistryError('meta/tags.json: must be an object of facet -> {exclusive, values}')
  }
  const seen = new Map<string, string>()
  for (const [facet, def] of Object.entries(raw)) {
    const d = def as { exclusive?: unknown; values?: unknown }
    if (typeof d.exclusive !== 'boolean' || typeof d.values !== 'object' || d.values === null || Array.isArray(d.values)) {
      throw new RegistryError(`meta/tags.json: facet '${facet}' must carry boolean exclusive and a values object`)
    }
    for (const [tag, desc] of Object.entries(d.values)) {
      if (typeof desc !== 'string') {
        throw new RegistryError(`meta/tags.json: tag '${tag}' description must be a string`)
      }
      if (seen.has(tag)) {
        throw new RegistryError(`meta/tags.json: tag '${tag}' appears in more than one facet`)
      }
      seen.set(tag, facet)
    }
  }
  return raw as TagVocabulary
}

export function facetOf(vocab: TagVocabulary, tag: string): string | null {
  for (const [facet, def] of Object.entries(vocab)) {
    if (tag in def.values) return facet
  }
  return null
}

export function loadProfiles(repoRoot: string): Profiles {
  const raw = parseJson(repoRoot, 'profiles.json')
  if (raw === null) return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new RegistryError('profiles.json: must be an object of name -> profile')
  }
  for (const [name, profile] of Object.entries(raw)) {
    const rules = (profile as { rules?: unknown }).rules
    if (!Array.isArray(rules) || rules.some((r) => typeof r !== 'string')) {
      throw new RegistryError(`profiles.json: profile '${name}' must carry a string[] rules field`)
    }
  }
  return raw as Profiles
}

export function validateComposition(
  assets: MetaAsset[],
  vocab: TagVocabulary,
  profiles: Profiles,
): string[] {
  const violations: string[] = []
  const rules = assets.filter((a) => a.kind === 'rule')
  const ruleNames = new Set(rules.map((r) => r.name))
  const usedTags = new Set<string>()
  for (const rule of rules) {
    if (rule.status === 'ready' && rule.tags.length === 0) {
      violations.push(`${rule.name}: ready rule must declare tags`)
    }
    const byFacet = new Map<string, string[]>()
    for (const tag of rule.tags) {
      usedTags.add(tag)
      const facet = facetOf(vocab, tag)
      if (facet === null) {
        violations.push(`${rule.name}: unknown tag '${tag}' (not in meta/tags.json)`)
        continue
      }
      byFacet.set(facet, [...(byFacet.get(facet) ?? []), tag])
    }
    for (const [facet, tags] of byFacet) {
      if (vocab[facet]?.exclusive === true && tags.length > 1) {
        violations.push(
          `${rule.name}: tags '${tags[0]}' and '${tags[1]}' are mutually exclusive within facet '${facet}'`,
        )
      }
    }
    for (const dep of rule.requires) {
      if (!ruleNames.has(dep)) violations.push(`${rule.name}: requires unknown rule '${dep}'`)
    }
  }
  for (const def of Object.values(vocab)) {
    for (const tag of Object.keys(def.values)) {
      if (!usedTags.has(tag)) violations.push(`orphan tag '${tag}' in meta/tags.json: no rule uses it`)
    }
  }
  const byName = new Map(rules.map((r) => [r.name, r]))
  for (const [name, profile] of Object.entries(profiles)) {
    for (const member of profile.rules) {
      const memberRule = byName.get(member)
      if (memberRule === undefined) {
        violations.push(`profile ${name}: unknown rule '${member}'`)
        continue
      }
      for (const dep of memberRule.requires) {
        if (!profile.rules.includes(dep)) {
          violations.push(`profile ${name}: '${member}' requires '${dep}' which is not in the profile`)
        }
      }
    }
    if (!profile.rules.includes('constitution')) {
      violations.push(`profile ${name}: missing constitution`)
    }
  }
  return violations
}
```

- [ ] **Step 4: 全量测试 + typecheck**

- [ ] **Step 5: Commit**

```bash
git add packages/meta-cli
git commit -m "feat(meta-cli): composition module with tag vocabulary, requires and profile validation"
```

### Task 4: status 集成校验与 --tag 过滤

**Files:**
- Modify: `packages/meta-cli/src/core/actions.ts`（ArgSpec/ActionParams/StatusRowData/statusAction）
- Modify: `packages/meta-cli/src/cli/index.ts`（option 参数映射 + paramsFrom）
- Modify: `packages/meta-cli/src/cli/render.ts`（renderStatus 新签名）
- Test: `packages/meta-cli/tests/actions.test.ts`、`packages/meta-cli/tests/cli.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `loadTagVocabulary/loadProfiles/validateComposition`、`RegistryError`
- Produces:
  - `ArgSpec.kind` 增加 `'option'`（字符串值）；`ActionParams` 增加可选 `options?: Record<string, string>`（TUI 调用点不必改）
  - `StatusRowData` 增加 `tags: string[]`、`requires: string[]`
  - status 的 `data` 形状变为 `StatusData = { rows: StatusRowData[]; violations: string[] }`
  - 退出码：pending 或 violations 非空 → 1

- [ ] **Step 1: 写失败测试**（actions.test.ts 现有 status 用例改断言 `data.rows`，并新增）

```ts
test('status reports composition violations with exit 1', async () => {
  // temp 仓库 fixture：一条 ready rule 带未知 tag；meta/tags.json 只含 ts
  // （沿用文件顶部既有的 temp-repo helper 构造方式）
  const result = await statusIn(repoWith({ 'meta/tags.json': '{"ts":"x"}', 'meta/rules/a.md': '---\nname: a\nstatus: ready\nscope: global\ntags: [nope]\n---\nbody' }))
  const data = result.data as { rows: unknown[]; violations: string[] }
  expect(data.violations).toContain("a: unknown tag 'nope' (not in meta/tags.json)")
  expect(result.exitCode).toBe(1)
})

test('status --tag filters rows', async () => {
  const result = await runAction(ctx, 'status', { positionals: [], flags: {}, options: { tag: 'ts' } })
  const data = result.data as { rows: { name: string }[] }
  expect(data.rows.every((r) => r.name !== 'constitution')).toBe(true)
})

test('malformed profiles.json fails status with the registry message', async () => {
  const result = await statusIn(repoWith({ 'profiles.json': '{"app":{"rules":"x"}}' }))
  expect(result.ok).toBe(false)
  expect(result.message).toContain("profiles.json: profile 'app'")
})
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现**

actions.ts：

```ts
export interface ArgSpec {
  name: string
  kind: 'positional' | 'flag' | 'option'
  required?: boolean
  variadic?: boolean
  description: string
}

export interface ActionParams {
  positionals: string[]
  flags: Record<string, boolean>
  options?: Record<string, string>
}

export interface StatusRowData {
  name: string
  kind: string
  status: string
  scope: string | null
  tags: string[]
  requires: string[]
  metaPath: string
  artifactPath: string
}

export interface StatusData {
  rows: StatusRowData[]
  violations: string[]
}
```

statusAction（args 增加 `{ name: 'tag', kind: 'option', description: 'filter rules by tag' }`）：

```ts
async execute(ctx, params) {
  let vocab: TagVocabulary
  let profiles: Profiles
  try {
    vocab = loadTagVocabulary(ctx.repoRoot)
    profiles = loadProfiles(ctx.repoRoot)
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
  const rows = loadOverview(ctx.repoRoot)
  const name = params.positionals[0]
  let selected = name ? rows.filter((r) => r.asset.name === name) : rows
  if (name && selected.length === 0) return fail(`unknown asset: ${name}`)
  const tag = params.options?.tag
  if (tag !== undefined) selected = selected.filter((r) => r.asset.tags.includes(tag))
  const dataRows: StatusRowData[] = selected.map((r) => ({
    name: r.asset.name,
    kind: r.asset.kind,
    status: r.status,
    scope: r.asset.scope,
    tags: r.asset.tags,
    requires: r.asset.requires,
    metaPath: r.asset.metaPath,
    artifactPath: r.asset.artifactPath,
  }))
  const violations = validateComposition(rows.map((r) => r.asset), vocab, profiles)
  const pending = dataRows.some((d) => PENDING_STATUSES.has(d.status))
  const data: StatusData = { rows: dataRows, violations }
  return { ok: true, data, exitCode: pending || violations.length > 0 ? 1 : 0 }
}
```

cli/index.ts：commandFor 中 flag 分支旁加

```ts
if (spec.kind === 'option') args[spec.name] = { type: 'string', description: spec.description }
```

paramsFrom 收集字符串值：

```ts
const options: Record<string, string> = {}
for (const [key, value] of Object.entries(args)) {
  if (key !== '_' && typeof value === 'string') options[key] = value
}
return { positionals, flags, options }
```

render.ts：

```ts
import type { SkillsStatusData, StatusData } from '../core/actions'

export function renderStatus(data: StatusData): string {
  const lines =
    data.rows.length === 0
      ? ['no assets']
      : data.rows.map((r) => `${r.name.padEnd(20)} ${r.kind.padEnd(8)} ${r.status.padEnd(10)}`.trimEnd())
  for (const v of data.violations) lines.push(`violation: ${v}`)
  return lines.join('\n')
}
```

cli/index.ts 的 QUERY_RENDERERS：`status: (d) => renderStatus(d as StatusData)`。
检查 `src/tui/` 与 `packages/preview/`：二者经 `loadOverview` 取数，不消费 status action 的 data，预期无改动；若 TUI 有消费处按同形状更新。

- [ ] **Step 4: 全量测试 + typecheck + parity**

Run: `cd packages/meta-cli && bun test && bunx tsc --noEmit`
Expected: PASS（含 tests/parity.test.ts——未新增 action）

- [ ] **Step 5: Commit**

```bash
git add packages/meta-cli
git commit -m "feat(meta-cli): status runs composition validation, gains --tag filter"
```

### Task 5: 词表 seed + 现有元指令补 tags/requires（控制器 inline）

**Files:**
- Create: `meta/tags.json`
- Modify: `meta/rules/{constitution,context-management,dependencies,typescript,react,nestjs,testing,markdown,python}.md`（仅 frontmatter）

- [ ] **Step 1: 写 meta/tags.json（分面化）**

```json
{
  "lang": {
    "exclusive": true,
    "values": {
      "ts": "TypeScript/JavaScript 生态",
      "python": "Python 生态"
    }
  },
  "layer": {
    "exclusive": true,
    "values": {
      "frontend": "前端",
      "backend": "后端"
    }
  },
  "framework": {
    "exclusive": true,
    "values": {
      "react": "React",
      "nestjs": "NestJS"
    }
  },
  "concern": {
    "exclusive": false,
    "values": {
      "core": "跨语言核心原则",
      "workflow": "AI 协作与会话工作流",
      "testing": "测试",
      "docs": "文档写作"
    }
  }
}
```

孤儿校验要求词表与内容同步演化：`nextjs`（framework 面）与 `ai`（concern 面）
两个值在 Task 6 创建 nextjs/ai-sdk/docs-retrieval 元指令时一并补入词表，
Task 5 时点不含（否则报孤儿违规）。

- [ ] **Step 2: 各元指令 frontmatter 追加**（scope 行之后）

- constitution：`tags: [core]`
- context-management：`tags: [core, workflow]`
- dependencies：`tags: [ts]`（Task 6 会删除此资产，暂补保持校验绿）
- typescript：`tags: [ts]`
- react：`tags: [ts, frontend, react]` + `requires: [typescript]`
- nestjs：`tags: [ts, backend, nestjs]` + `requires: [typescript]`
- testing：`tags: [ts, testing]`
- markdown：`tags: [docs]`
- python：`tags: [python]`

- [ ] **Step 3: 验证零重建 + 校验绿**

Run: `imeta status`
Expected: 全部 synced（补 tag 不改 hash——Task 2 的排除生效）、无 violation、退出码 0

- [ ] **Step 4: Commit**

```bash
git add meta/tags.json meta/rules
git commit -m "feat(rules): seed tag vocabulary and tag all rule metas"
```

### Task 6: 拆分元指令（控制器 inline）

**Files:**
- Modify: `meta/rules/constitution.md`（删「TypeScript 类型」红线一条）
- Modify: `meta/rules/typescript.md`（吸收双重断言 + `@ts-ignore` 红线；删除「constitution 已有不重复」表述）
- Modify: `meta/rules/react.md`（移除 Next.js 专属：目录树中 `app/` 行、「app/ 只做路由编排」「业务逻辑与复杂 JSX 下沉」条目）
- Create: `meta/rules/nextjs.md`（scope `"**/*.tsx"`，`tags: [ts, frontend, nextjs]`，`requires: [react]`；素材：`app/` 只做路由编排——metadata、dynamic 配置、组合 feature 组件；页面文件保持薄，业务逻辑与复杂 JSX 下沉 `features/`）
- Modify: `meta/rules/markdown.md`（移除「面向检索与 AI 消费」节）
- Create: `meta/rules/docs-retrieval.md`（scope `"**/*.md"`，`tags: [docs, ai]`，`requires: [markdown]`；素材：章节自包含/禁悬空引用/术语首次定义、代码三件套、关键信息不只在图片、Diátaxis 分篇——即原 markdown 元指令该节原文）
- Create: `meta/rules/dependencies-ts.md`（scope global，`tags: [ts]`；素材：原 dependencies 元指令全部内容减去 Vercel AI SDK 条）
- Create: `meta/rules/ai-sdk.md`（scope global，`tags: [ai, ts]`；素材：AI 应用生产落地默认 Vercel AI SDK——多 provider 切换、streaming UI）
- Delete: `meta/rules/dependencies.md`
- Modify: `meta/tags.json`（framework 面补 `"nextjs": "Next.js"`，concern 面补 `"ai": "AI 应用与 AI 消费"`）

**要点：** 新元指令一律 `status: ready`，正文按既有元指令格式（目标 / 约束素材 / 产物要求），素材从被拆文件原文迁移不改写；react 与 markdown 的「素材源」行同步更新。

- [ ] **Step 1: 完成上述 8 处元指令编辑**
- [ ] **Step 2: 中间态确认**：`imeta status` 此时 constitution/typescript/react/markdown 为 stale，四个新资产 unbuilt，dependencies 行消失但产物文件仍在（`rules/global/dependencies.md` 留待 Task 7 清理）
- [ ] **Step 3: Commit**

```bash
git add meta/rules
git commit -m "feat(rules): split metas per composition spec (constitution slim, dependencies-ts/ai-sdk, react/nextjs, markdown/docs-retrieval)"
```

### Task 7: 构建收敛 + profile seed（控制器 inline，构建期间仓库静默）

**Files:**
- 构建产物：`rules/global/{constitution,dependencies-ts,ai-sdk}.md`、`rules/scoped/{typescript,react,nextjs,markdown,docs-retrieval}.md`
- Delete: `rules/global/dependencies.md` + `artifacts.lock.json` 的 `rule:dependencies` 项
- Modify: `.claude/rules/constitution.md`（分发副本同步）
- Create: `profiles.json`

- [ ] **Step 1: 串行构建 8 个**（后台单链，期间不做任何仓库改动）

```bash
for name in constitution typescript react nextjs markdown docs-retrieval dependencies-ts ai-sdk; do imeta build "$name" || echo "BUILD_FAILED: $name"; done
```

- [ ] **Step 2: 清理旧产物与 lock 项**

```bash
git rm rules/global/dependencies.md
bun -e 'const p="artifacts.lock.json";const l=JSON.parse(await Bun.file(p).text());delete l["rule:dependencies"];await Bun.write(p, JSON.stringify(l,null,2)+"\n")'
```

- [ ] **Step 3: 同步分发副本**：`cp rules/global/constitution.md .claude/rules/constitution.md`

- [ ] **Step 4: 写 profiles.json**

```json
{
  "nextjs-app": {
    "description": "Next.js App Router 应用",
    "rules": ["constitution", "context-management", "dependencies-ts", "typescript", "react", "nextjs", "testing", "markdown"]
  },
  "react-spa": {
    "description": "React SPA（Vite 等）",
    "rules": ["constitution", "context-management", "dependencies-ts", "typescript", "react", "testing", "markdown"]
  },
  "nestjs-api": {
    "description": "NestJS 后端服务",
    "rules": ["constitution", "context-management", "dependencies-ts", "typescript", "nestjs", "testing", "markdown"]
  },
  "python-cli": {
    "description": "Python 项目",
    "rules": ["constitution", "context-management", "python", "markdown"]
  }
}
```

- [ ] **Step 5: 终态验证**

Run: `imeta status && cd packages/meta-cli && bun test`
Expected: 12 rule 资产全 synced、violations 空、退出码 0；测试全绿。
产物抽查：constitution 无 TS 红线；typescript 含双重断言/`@ts-ignore` 红线；react 无 `app/` 内容；nextjs/docs-retrieval/dependencies-ts/ai-sdk 与元指令对齐。

- [ ] **Step 6: Commit**

```bash
git add rules meta profiles.json artifacts.lock.json .claude/rules/constitution.md
git commit -m "feat(rules): build split rules, seed profiles, retire dependencies rule"
```
