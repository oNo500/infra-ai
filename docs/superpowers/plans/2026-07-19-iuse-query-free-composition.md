# iuse 查询层与自由组合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iuse 获得一等查询维度（list/show/browse）与自由组合能力（init --rules、update --add/--remove），数据来自源端新产物 catalog.json。

**Architecture:** meta-cli 生成 catalog.json（meta frontmatter/tags.json/profiles.json 的派生视图，imeta status 校验新鲜度）；iuse 端 lock.rules 集合成为安装事实 SSoT，profile 降为种子；上游 profile 新增呈现为 available，须显式 --add。TUI 新增 browse 左右分屏视图。

**Tech Stack:** Bun + TypeScript、citty、ink 6 + React 19、gray-matter（已有依赖，均不新增）。

**Spec:** `docs/superpowers/specs/2026-07-18-iuse-query-free-composition-design.md`（一切以 spec 为准）

## Global Constraints

- 文件与目录一律 kebab-case；源代码禁 emoji；commit 英文 Conventional Commits
- commit trailer：`Claude-Session: https://claude.ai/code/session_014qFwy6t5VhLF85toupsepd`
- 禁 `!` 非空断言、`@ts-ignore`、双重断言；oxlint + `bunx tsc --noEmit` 必须全绿
- 帮助文本/TUI 文案中文为主；`--json` 单行 JSON
- meta-cli 新动作必须先进 `packages/meta-cli/src/core/actions.ts` 注册表再接 `src/tui/keymap.ts`；`tests/parity.test.ts` 不过不得提交
- TUI 测试写键必须走既有 `press()` 夹具（丢键防护），等待用 `waitFor()`（超时帧转储）
- 编辑过程中的实时 LSP 诊断不作准，以批次后 `bunx tsc --noEmit` 为准
- 每个 task 内：测试先行（Red-Green），task 完成即 commit

## 现有契约速览（实现者必读）

- `packages/meta-cli/src/core/meta.ts`：`MetaAsset { name, kind, status, scope, tags, requires, metaPath, artifactPath }`；`parseMetaFile(content, filename, kind)` 用 gray-matter 解析 frontmatter；`discoverAssets(repoRoot)` 扫 `meta/<kind>/`
- `packages/meta-cli/src/core/composition.ts`：`loadProfiles`、`loadTagVocabulary`（返回 `TagVocabulary = Record<string, TagFacet>`，facet 含 `exclusive` 与 `values`）、`validateComposition`
- `packages/meta-cli/src/core/actions.ts`：`ActionDef { id, summary, kind: 'query'|'mutation', args, execute }`，加入 `ACTIONS` 数组即自动进 CLI；TUI 键位在 `src/tui/keymap.ts` 的 `KEYMAP` 数组
- `packages/iuse/src/core/assemble.ts`：`planAssembly(sourceRoot, profileName)` → `{ items: AssemblyItem[], violations }`，`AssemblyItem { rule, sourcePath, targetRelPath, content, hash }`
- `packages/iuse/src/core/manifest.ts`：`DownstreamLock { source, profile, appliedAt, rules: Record<string,string>, templates, excluded? }`；`DriftState`、`computeDrift(localHash, baselineHash, sourceHash)`、`localHashFor`、`ruleTargetRelPath`
- `packages/iuse/src/core/report.ts`：`statusReport` 现把「profile 有而 lock 无」报为 outdated——本轮要改为 available
- `packages/iuse/src/core/update.ts`：`planUpdate/runUpdate`，现有 `include`（回补 excluded）与自动 `add`（profile 新增）——本轮併入 `--add` 并取消自动新增
- `packages/iuse/src/cli/index.ts`：`splitNames`（逗号分隔解析）、`renderJson`、`defaultContext`、`buildMainCommand`、TUI 门 `runCli`
- `packages/iuse/src/tui/app.tsx`：`TuiDeps { ctx, target, source? }`、视图路由 state machine；测试夹具在 `tests/tui-init-flow.test.tsx` / `tests/tui-status-flow.test.tsx`（fixtureSource/fakeCtx/press/waitFor/bootApp）

---

### Task 1: description 元数据全链路（meta 解析 + 16 条回写 + 契约文档 + 校验）

**Files:**
- Modify: `packages/meta-cli/src/core/meta.ts`（MetaAsset + parseMetaFile 增加 description）
- Modify: `packages/meta-cli/src/core/composition.ts`（validateComposition 增加 ready rule 缺 description 校验）
- Modify: `meta/rules/*.md`（16 个文件 frontmatter 各加一行 description）
- Modify: `meta/prompts/rule-build.md`、`meta/README.md`（记录 description 字段）
- Test: `packages/meta-cli/tests/meta.test.ts`、`packages/meta-cli/tests/composition.test.ts`（就现有文件追加用例）

**Interfaces:**
- Consumes: 现有 `parseMetaFile`、`validateComposition(assets, vocab, profiles)`
- Produces: `MetaAsset.description: string`（缺失时空串）；violation 文案格式 `` `${name}: ready rule missing description` ``——Task 2 的 catalog 生成依赖非空 description

- [ ] **Step 1: 失败测试——parseMetaFile 读出 description**

在 `packages/meta-cli/tests/meta.test.ts` 追加：

```ts
test('parseMetaFile surfaces frontmatter description, defaults to empty string', () => {
  const withDesc = parseMetaFile(
    '---\nname: demo\nstatus: ready\nscope: global\ndescription: 一句话说明\ntags: [core]\n---\nbody',
    'demo.md',
    'rule',
  )
  expect(withDesc.description).toBe('一句话说明')

  const without = parseMetaFile('---\nname: demo2\nstatus: ready\n---\nbody', 'demo2.md', 'rule')
  expect(without.description).toBe('')
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/meta-cli && bun test tests/meta.test.ts`
Expected: FAIL（description 属性不存在，tsc 或断言失败）

- [ ] **Step 3: 实现——meta.ts**

`MetaAsset` 增加 `description: string`；`parseMetaFile` 返回对象增加：

```ts
description: typeof data.description === 'string' ? data.description.trim() : '',
```

注意 `metaContentHash` 的 `kept` 对象**不要**加 description——description 是管理元数据，改描述不应导致产物 stale（与既有 tags/requires 同规则）。

- [ ] **Step 4: 失败测试——ready rule 缺 description 计为 violation**

在 `packages/meta-cli/tests/composition.test.ts` 追加（沿用该文件现有的 asset 构造 helper；若无则内联构造 `MetaAsset` 字面量）：

```ts
test('ready rule without description is a violation; stub without is fine', () => {
  const assets: MetaAsset[] = [
    { name: 'a', kind: 'rule', status: 'ready', scope: 'global', tags: ['core'], requires: [], metaPath: 'meta/rules/a.md', artifactPath: 'rules/global/a.md', description: '' },
    { name: 'b', kind: 'rule', status: 'stub', scope: 'global', tags: ['core'], requires: [], metaPath: 'meta/rules/b.md', artifactPath: 'rules/global/b.md', description: '' },
  ]
  const violations = validateComposition(assets, vocab, {})
  expect(violations).toContain('a: ready rule missing description')
  expect(violations.some((v) => v.startsWith('b:'))).toBe(false)
})
```

- [ ] **Step 5: 跑测试确认失败，然后在 validateComposition 里实现该检查**

对 `kind === 'rule' && status === 'ready' && description === ''` 的资产 push `` `${name}: ready rule missing description` ``。

- [ ] **Step 6: 给 16 条 rule 元指令补 description frontmatter**

对 `meta/rules/` 下每个文件：先读正文（元指令首段即该 rule 的用途说明），在 frontmatter `name:` 行后插入一行 `description: <一句话中文>`。以下草稿供起点，与正文冲突时以正文为准改写：

- agent-behavior: `AI 协作行为红线：不确定即问、忽略实时 LSP 诊断、研究子代理纪律`
- ai-sdk: `AI 应用选型：生产落地默认 Vercel AI SDK，Python 侧只做前沿实验`
- constitution: `跨项目核心工程原则与不可违反规则（Library/MVP/FP-First）`
- context-management: `会话上下文管理：CLAUDE.md 定位、memory 与规则分层`
- css: `样式方案选型与约束（Tailwind 优先）`
- database: `数据库选型与访问层约束`
- dependencies-ts: `TS 依赖管理：pnpm、版本策略、packageManager 字段`
- docs-retrieval: `文档检索链路：context7 -> 用例检索 -> 搜索兜底`
- markdown: `Markdown 文档写作规范：标来源、禁隐喻、AI 规则文档约定`
- nestjs: `NestJS 后端项目结构与惯用法约束`
- nextjs: `Next.js App Router 项目约束`
- python: `Python 工具链：uv/ruff/pyright 与项目组织`
- react: `React 组件与状态管理约束`
- testing: `测试策略与工具选型约束`
- tooling: `开发工具选用：LSP 优先、rg/fd 限文本、gh CLI、sg`
- typescript: `TypeScript 语言与编译约束`

- [ ] **Step 7: 更新契约文档**

`meta/README.md` 的 frontmatter 字段说明处加 `description`（一句话、面向使用者、必填于 ready rule）；`meta/prompts/rule-build.md` 在构建输入说明处注明 description 只是管理元数据、不进产物正文。

- [ ] **Step 8: 全量验证**

Run: `cd packages/meta-cli && bun run test && bunx tsc --noEmit && bun run lint`
Expected: 全绿。再跑 `cd ../.. && pnpm meta status`，Expected: 退 0（16 条已全部补齐 description，无新 violation；有则说明某条漏补）。

- [ ] **Step 9: Commit**

```bash
git add packages/meta-cli meta/
git commit -m "feat(meta): rule description metadata with ready-rule validation"
```

---

### Task 2: catalog 产物（生成、校验、动作注册、构建挂钩）

**Files:**
- Create: `packages/meta-cli/src/core/catalog.ts`
- Modify: `packages/meta-cli/src/core/actions.ts`（新 action `catalog`；`build` action 成功后重建 catalog；`status` action 附加 catalog 新鲜度检查）
- Modify: `packages/meta-cli/src/core/index.ts`（导出 loadCatalog 及类型，Task 3 iuse 复用）
- Modify: `packages/meta-cli/src/tui/keymap.ts`（`{ actionId: 'catalog', view: 'assets', key: 'g' }`）
- Modify: `.claude/rules/architecture.md`（结构图 profiles.json 行后加 catalog.json 一行）
- Test: `packages/meta-cli/tests/catalog.test.ts`（新建）

**Interfaces:**
- Consumes: Task 1 的 `MetaAsset.description`；`discoverAssets`、`loadTagVocabulary`、`loadProfiles`
- Produces（iuse 在 Task 3 消费，签名必须一致）:

```ts
export interface CatalogRule {
  description: string
  tags: string[]
  scope: string
  path: string       // 产物相对路径，如 rules/global/constitution.md
  profiles: string[] // 按名排序
}
export interface Catalog {
  generatedAt: string
  tags: TagVocabulary
  rules: Record<string, CatalogRule> // 键按名排序
}
export function buildCatalog(repoRoot: string, now: () => string): Catalog
export function renderCatalog(catalog: Catalog): string // JSON.stringify(catalog, null, 2) + '\n'
export function loadCatalog(root: string): Catalog | null // 读 <root>/catalog.json；不存在返回 null；坏 JSON 抛错
export function catalogStaleness(repoRoot: string): string | null // 新鲜返回 null，否则一句话原因
```

- [ ] **Step 1: 失败测试——buildCatalog 派生规则视图**

`packages/meta-cli/tests/catalog.test.ts`（fixture 用 mkdtemp 建最小源仓：meta/rules 两条 ready rule 带 description/tags、meta/tags.json、profiles.json 一个 profile 含其中一条）：

```ts
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildCatalog, catalogStaleness, loadCatalog, renderCatalog } from '../src/core/catalog'

function fixtureRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'imeta-catalog-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  writeFileSync(join(dir, 'meta', 'tags.json'), JSON.stringify({ concern: { exclusive: false, values: { core: '核心' } } }))
  writeFileSync(join(dir, 'meta', 'rules', 'alpha.md'), '---\nname: alpha\nstatus: ready\nscope: global\ndescription: 甲说明\ntags: [core]\n---\nbody')
  writeFileSync(join(dir, 'meta', 'rules', 'beta.md'), '---\nname: beta\nstatus: ready\nscope: global\ndescription: 乙说明\ntags: [core]\n---\nbody')
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { description: 'd', rules: ['alpha'] } }))
  return dir
}

describe('catalog', () => {
  test('buildCatalog derives rules with description, tags, profile membership', () => {
    const repo = fixtureRepo()
    const catalog = buildCatalog(repo, () => '2026-07-19T00:00:00Z')
    expect(Object.keys(catalog.rules)).toEqual(['alpha', 'beta'])
    expect(catalog.rules.alpha).toEqual({
      description: '甲说明', tags: ['core'], scope: 'global',
      path: 'rules/global/alpha.md', profiles: ['demo'],
    })
    expect(catalog.rules.beta?.profiles).toEqual([])
    expect(catalog.tags.concern?.values.core).toBe('核心')
  })

  test('staleness: missing file, then fresh after write, then stale after meta change', () => {
    const repo = fixtureRepo()
    expect(catalogStaleness(repo)).toContain('catalog.json missing')
    writeFileSync(join(repo, 'catalog.json'), renderCatalog(buildCatalog(repo, () => 'x')))
    expect(catalogStaleness(repo)).toBeNull()
    writeFileSync(join(repo, 'meta', 'rules', 'alpha.md'), '---\nname: alpha\nstatus: ready\nscope: global\ndescription: 改了\ntags: [core]\n---\nbody')
    expect(catalogStaleness(repo)).toContain('stale')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/meta-cli && bun test tests/catalog.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 catalog.ts**

```ts
import { join } from 'node:path'
import { readTextIfExists } from './io'
import { loadProfiles, loadTagVocabulary } from './composition'
import type { TagVocabulary } from './composition'
import { discoverAssets } from './meta'

// CatalogRule / Catalog 接口见上方 Interfaces 块，原样落码

export function buildCatalog(repoRoot: string, now: () => string): Catalog {
  const assets = discoverAssets(repoRoot).filter((a) => a.kind === 'rule' && a.status === 'ready')
  const profiles = loadProfiles(repoRoot)
  const memberOf = (rule: string): string[] =>
    Object.entries(profiles).filter(([, p]) => p.rules.includes(rule)).map(([name]) => name).toSorted()
  const rules: Record<string, CatalogRule> = {}
  for (const asset of [...assets].toSorted((a, b) => a.name.localeCompare(b.name))) {
    rules[asset.name] = {
      description: asset.description,
      tags: asset.tags,
      scope: asset.scope ?? 'global',
      path: asset.artifactPath,
      profiles: memberOf(asset.name),
    }
  }
  return { generatedAt: now(), tags: loadTagVocabulary(repoRoot), rules }
}

export function renderCatalog(catalog: Catalog): string {
  return `${JSON.stringify(catalog, null, 2)}\n`
}

export function loadCatalog(root: string): Catalog | null {
  const raw = readTextIfExists(join(root, 'catalog.json'))
  if (raw === null) return null
  try {
    return JSON.parse(raw) as Catalog
  } catch (error) {
    throw new Error(`catalog.json: invalid JSON (${String(error)})`)
  }
}

export function catalogStaleness(repoRoot: string): string | null {
  const existing = loadCatalog(repoRoot)
  if (existing === null) return "catalog.json missing (run 'imeta catalog')"
  const derived = buildCatalog(repoRoot, () => existing.generatedAt)
  return JSON.stringify(existing) === JSON.stringify(derived)
    ? null
    : "catalog.json stale (run 'imeta catalog')"
}
```

跑 Step 1 测试至绿。

- [ ] **Step 4: 注册 catalog action + keymap + status 挂钩 + build 挂钩**

actions.ts 新增（放在 statusAction 附近，并加入文件底部的 `ACTIONS` 数组）：

```ts
const catalogAction: ActionDef = {
  id: 'catalog',
  summary: 'Regenerate catalog.json from meta frontmatter, tags and profiles',
  kind: 'mutation',
  args: [],
  async execute(ctx) {
    try {
      const catalog = buildCatalog(ctx.repoRoot, ctx.now)
      writeFileAtomic(join(ctx.repoRoot, 'catalog.json'), renderCatalog(catalog))
      return { ok: true, message: `catalog.json: ${Object.keys(catalog.rules).length} rules` }
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error))
    }
  },
}
```

status action 的 execute 末尾（violations 汇总处）追加：`const staleness = catalogStaleness(ctx.repoRoot); if (staleness !== null) violations.push(staleness)`（对齐该函数内 violations 的实际变量名）。build action 在 `recordBuild` 成功路径后追加同 catalogAction 的写盘两行（重建产物后 catalog 必然可能变化）。keymap.ts 加 `{ actionId: 'catalog', view: 'assets', key: 'g' }`。

- [ ] **Step 5: 全量验证 + 生成真 catalog**

Run: `cd packages/meta-cli && bun run test && bunx tsc --noEmit && bun run lint`（parity.test.ts 必须绿）
Run: `cd ../.. && pnpm meta catalog && pnpm meta status`
Expected: 仓库根出现 catalog.json，16 条 rule 全带 description；status 退 0。`.claude/rules/architecture.md` 结构图补一行 `├── catalog.json  # 构建产物：资产查询视图（imeta catalog 生成）`。

- [ ] **Step 6: Commit**

```bash
git add packages/meta-cli catalog.json .claude/rules/architecture.md
git commit -m "feat(meta): catalog.json artifact with freshness check and registry action"
```

---

### Task 3: iuse core——显式集合装配、available 状态机、add/remove

**Files:**
- Modify: `packages/iuse/src/core/assemble.ts`（新增 `assembleRules`；`planAssembly` 改为其薄封装）
- Modify: `packages/iuse/src/core/manifest.ts`（DriftState 增 `'available'`）
- Modify: `packages/iuse/src/core/report.ts`（statusReport 改集合语义 + available 段）
- Modify: `packages/iuse/src/core/init.ts`（`rules?: string[]` 直选，lock.profile 记 `'-'`）
- Modify: `packages/iuse/src/core/update.ts`（`--include`/自动 add 併入 `add?: string[]`；新增 `remove?: string[]`）
- Test: `packages/iuse/tests/assemble.test.ts`、`tests/report.test.ts`、`tests/update.test.ts`、`tests/init.test.ts`（就现有文件追加/调整）

**Interfaces:**
- Consumes: Task 2 的 `loadCatalog`（本 task 不用，仅 Task 4 用；本 task 纯 hash/集合逻辑）
- Produces:

```ts
// assemble.ts
export function assembleRules(sourceRoot: string, rules: string[]):
  { items: AssemblyItem[]; missing: string[]; violations: string[] }
// missing: 源端已无此资产（update 视为 drop）；violations: 已知资产但产物文件缺失
export function planAssembly(sourceRoot: string, profileName: string):
  { items: AssemblyItem[]; violations: string[] } // 行为不变，内部走 assembleRules

// manifest.ts
export type DriftState = 'synced' | 'modified' | 'outdated' | 'missing' | 'excluded' | 'available'

// init.ts runInit opts 增: rules?: string[]（与 profile 互斥，caller 校验）；profile: string 允许 '-'
// update.ts runUpdate opts: include/overwrite 改为 add?: string[]; remove?: string[]; overwrite?: string[]
```

- [ ] **Step 1: 失败测试——assembleRules**

`tests/assemble.test.ts` 追加（沿用文件现有 fixture helper 建源仓）：

```ts
test('assembleRules resolves explicit names; unknown names land in missing', () => {
  const root = fixtureSource() // 含 constitution
  const { items, missing, violations } = assembleRules(root, ['constitution', 'ghost'])
  expect(items.map((i) => i.rule)).toEqual(['constitution'])
  expect(missing).toEqual(['ghost'])
  expect(violations).toEqual([])
})
```

Run: `cd packages/iuse && bun test tests/assemble.test.ts` → FAIL

- [ ] **Step 2: 实现 assemble.ts**

```ts
export function assembleRules(
  sourceRoot: string,
  rules: string[],
): { items: AssemblyItem[]; missing: string[]; violations: string[] } {
  const assets = discoverAssets(sourceRoot)
  const byName = new Map(assets.filter((a) => a.kind === 'rule').map((a) => [a.name, a]))
  const items: AssemblyItem[] = []
  const missing: string[] = []
  const violations: string[] = []
  for (const rule of [...rules].toSorted()) {
    const asset = byName.get(rule)
    if (asset === undefined) {
      missing.push(rule)
      continue
    }
    const sourcePath = join(sourceRoot, asset.artifactPath)
    const content = readTextIfExists(sourcePath)
    if (content === null) {
      violations.push(`${rule}: built artifact missing at ${asset.artifactPath} (run imeta build in the source)`)
      continue
    }
    items.push({ rule, sourcePath, targetRelPath: ruleTargetRelPath(rule), content, hash: sha256(content) })
  }
  return { items, missing, violations }
}
```

`planAssembly` 保留签名：展开 profile（unknown profile 仍抛错）、跑 `validateComposition`（profile 路径保留组合校验，spec：requires 只在源端/profile 路径校验）、把 profile rules 交给 assembleRules，missing 并入 violations（profile 引用不存在的 rule 在 validateComposition 已计入，去重即可——直接沿用其 violations，missing 不重复上报）。跑测试至绿，并确认既有 assemble 用例不回归。

- [ ] **Step 3: 失败测试——statusReport 集合语义**

`tests/report.test.ts` 追加：

```ts
test('profile-new rule reports available, not outdated, and does not affect exit code', async () => {
  // fixture: init 后向源 profile 加 extra（现有 initTargetWithAllStates 同款手法）
  const result = await statusReport(fakeCtx(), { source, target })
  const extra = result.rows.find((r) => r.rule === 'extra')
  expect(extra?.state).toBe('available')
  // 其余行全 synced 时 available 不把退出码顶成 1
})

test('rules-only target (profile "-") reports locked rules without consulting profiles', async () => {
  // fixture: runInit({ rules: ['constitution'], profile: '-' , ... }) 后 statusReport
  // 断言 rows 只含 constitution=synced，无 available 段
})
```

Run → FAIL

- [ ] **Step 4: 实现 report.ts**

重写 statusReport 的装配部分：

```ts
const locked = Object.keys(lock.rules)
const { items, missing, violations } = assembleRules(source.root, locked)
// violations 非空仍整体失败（同现状）；missing 的 rule 在下方按 sourceHash=null 走 computeDrift（呈现 outdated/missing 语义不变）
const sourceHashByRule = new Map(items.map((i) => [i.rule, i.hash]))
// lock.rules 行：与现状相同的 computeDrift 循环
// available 段：lock.profile !== '-' 时 loadProfiles(source.root)[lock.profile]?.rules 中
//   不在 lock.rules 且不在 excluded 的，push { rule, state: 'available' }
//   （profile 已被上游删除时 available 段为空，不报错——种子只是提示来源）
// excluded 段保持现状
const exitCode = rows.some((r) => r.state !== 'synced' && r.state !== 'excluded' && r.state !== 'available') ? 1 : 0
```

注意不再调用 planAssembly / validateComposition（状态对账不需要组合校验；unknown-profile 抛错路径随之消失，对应旧测试若有断言需调整为 available 空段）。跑测试至绿。

- [ ] **Step 5: 失败测试——update add/remove 与自动新增取消**

`tests/update.test.ts` 调整/追加：

```ts
test('profile-new rule is NOT auto-added by update; --add pulls it in', async () => {
  // init 后向源 profile 加 extra
  const plain = await runUpdate(fakeCtx(), { target, force: false, dryRun: true })
  expect(plain.steps?.some((s) => s.op === 'add')).toBe(false)
  const added = await runUpdate(fakeCtx(), { target, force: false, add: ['extra'] })
  expect(added.ok).toBe(true)
  const lock = loadDownstreamLock(target)
  expect(Object.keys(lock?.rules ?? {})).toContain('extra')
})

test('--add re-includes an excluded rule (former --include semantics)', async () => {
  // initTargetWithExcludedRule 同款 fixture：excluded 含 gone
  const result = await runUpdate(fakeCtx(), { target, force: false, add: ['gone'] })
  expect(result.ok).toBe(true)
  const lock = loadDownstreamLock(target)
  expect(lock?.excluded ?? []).not.toContain('gone')
  expect(Object.keys(lock?.rules ?? {})).toContain('gone')
})

test('--remove deletes the copy, drops the lock entry, records exclusion', async () => {
  const result = await runUpdate(fakeCtx(), { target, force: false, remove: ['edited'] })
  expect(result.ok).toBe(true)
  expect(existsSync(join(target, '.claude/rules/edited.md'))).toBe(false)
  const lock = loadDownstreamLock(target)
  expect(Object.keys(lock?.rules ?? {})).not.toContain('edited')
  expect(lock?.excluded ?? []).toContain('edited')
})

test('--add unknown name fails with the unknown list', async () => {
  const result = await runUpdate(fakeCtx(), { target, force: false, add: ['nope'] })
  expect(result.ok).toBe(false)
  expect(result.message).toContain('nope')
})
```

Run → FAIL

- [ ] **Step 6: 实现 update.ts**

planUpdate 重构要点（保持 UpdatePlan 结构，nextExcluded 语义不变）：

- 目标集合 = `Object.keys(lock.rules)`，装配走 `assembleRules(source.root, [...locked, ...add])`；不再调用 planAssembly/validateComposition，不再依赖 lock.profile
- add 校验：`add` 中既不在源资产（assembleRules missing）→ `fail('unknown rules in --add: ...')`；已在 lock.rules 且非 excluded → fail（`already installed`）
- 现有第 114-120 行「profile 新增自动 add」循环整体删除
- 现有 include 门（第 125-145 行）改由 add 驱动：`add ∩ excluded` 走原 include 逻辑（op 仍叫 `include`，语义为回补）；`add − excluded` 生成 `{ op: 'add', target: item.targetRelPath }`（原 add 执行分支复用）
- remove：对每个名字，不在 lock.rules → fail；否则 push `{ op: 'remove', target: ruleTargetRelPath(rule), note: 'removed and excluded' }`；执行分支 `rmSync(join(opts.target, step.target), { force: true })`、`delete nextRules[rule]`、`excludedAfter.add(rule)`
- drop 分支条件从「item === undefined（不在 profile）」改为「rule ∈ assembleRules().missing（源端已无该资产）」，文案不变
- opts 类型：`include` 改名 `add`，新增 `remove`；全仓 `grep -rn 'include' packages/iuse/src packages/iuse/tests` 清理旧名（TUI 的 re-include 流在 Task 5 一并接到 add）

跑 update.test.ts 至绿；既有 include 用例改名后语义应全部保留。

- [ ] **Step 7: 失败测试 + 实现——init --rules**

`tests/init.test.ts` 追加：

```ts
test('init with explicit rules writes lock.profile "-" and only those rules', async () => {
  const result = await runInit(fakeCtx(), { source, profile: '-', rules: ['constitution'], target, force: false })
  expect(result.ok).toBe(true)
  const lock = loadDownstreamLock(target)
  expect(lock?.profile).toBe('-')
  expect(Object.keys(lock?.rules ?? {})).toEqual(['constitution'])
})
```

实现：planInit 里 `opts.rules !== undefined` 时用 `assembleRules(source.root, opts.rules)`（missing 非空 → fail `unknown rules: ...`；不跑 validateComposition），否则走现有 planAssembly；exclude 仅在 profile 路径有效（rules 路径给 exclude → fail）。saveDownstreamLock 的 profile 用 opts.profile（caller 传 `'-'`）。

- [ ] **Step 8: 全量验证 + Commit**

Run: `cd packages/iuse && bun run test && bunx tsc --noEmit && bun run lint`
Expected: 全绿（含既有 TUI 测试——若 TUI 因 op 改名/状态新增编译失败，本步一并修正文案映射，行为调整留给 Task 5）。

```bash
git add packages/iuse
git commit -m "feat(iuse): explicit-set semantics with available state and add/remove"
```

---

### Task 4: CLI——list/show 命令与组合旗标接线

**Files:**
- Create: `packages/iuse/src/core/list.ts`、`packages/iuse/src/core/show.ts`
- Modify: `packages/iuse/src/cli/index.ts`（list/show 子命令；init 加 `--rules`；update 换 `--add`/`--remove`）
- Test: `packages/iuse/tests/list.test.ts`、`tests/show.test.ts`（新建）、`tests/cli.test.ts`（追加旗标解析用例，若该文件存在）

**Interfaces:**
- Consumes: Task 2 `loadCatalog`（从 `@infra-ai/meta-cli/core` 导入）；Task 3 状态机
- Produces:

```ts
// list.ts
export interface ListRow {
  name: string
  description: string
  tags: string[]
  scope: string
  state?: DriftState | 'uninstalled' | 'broken' // 未初始化目标无 state；broken=catalog 指向的产物缺失
}
export async function listReport(ctx: IuseContext, opts: {
  source?: string; target: string; tags?: string[]; grep?: string
}): Promise<{ ok: boolean; message?: string; rows: ListRow[]; exitCode: number }> // 恒退 0（源解析失败除外）

// show.ts
export async function showReport(ctx: IuseContext, opts: {
  source?: string; target: string; name: string
}): Promise<{ ok: boolean; message?: string; entry?: CatalogRule & { name: string; state?: string }; content?: string; exitCode: number }>
```

- [ ] **Step 1: 失败测试——listReport 过滤与状态标注**

`tests/list.test.ts`（fixture 建带 catalog.json 的源仓——直接手写 catalog 内容与产物文件对齐；目标用 runInit 建）：

```ts
test('list surfaces catalog rows; --tag intersects; --grep matches name/description/content', async () => {
  const all = await listReport(fakeCtx(), { source, target: uninitTarget })
  expect(all.rows.map((r) => r.name)).toEqual(['alpha', 'beta'])
  expect(all.rows[0]?.state).toBeUndefined()
  const tagged = await listReport(fakeCtx(), { source, target: uninitTarget, tags: ['core'] })
  const grepped = await listReport(fakeCtx(), { source, target: uninitTarget, grep: '甲' })
  expect(grepped.rows.map((r) => r.name)).toEqual(['alpha'])
})

test('initialized target annotates install states incl. uninstalled and excluded', async () => {
  const result = await listReport(fakeCtx(), { source, target: initializedTarget })
  // constitution -> synced; profile 外未装 -> uninstalled; excluded -> excluded; profile 新增 -> available
})

test('missing catalog fails with imeta catalog hint', async () => {
  const result = await listReport(fakeCtx(), { source: bareSource, target: uninitTarget })
  expect(result.ok).toBe(false)
  expect(result.message).toContain('imeta catalog')
  expect(result.exitCode).toBe(1)
})
```

Run → FAIL

- [ ] **Step 2: 实现 list.ts**

流程：resolveSource → `loadCatalog(source.root)`（null → fail 带 `run 'imeta catalog' in the source` 提示）→ rows 从 catalog.rules 构建 → 过滤（tags 取交集：`opts.tags.every((t) => rule.tags.includes(t))`；grep：name/description 命中或 `readTextIfExists(join(source.root, rule.path))` 内容子串命中）→ 目标已初始化时按 Task 3 状态机标注 state（复用 statusReport 的行集合：locked 状态 + available + excluded；catalog 中其余为 `uninstalled`；catalog 条目产物文件缺失为 `broken` 且不中断）。恒退 0（resolve/catalog 失败除外，退 1）。

- [ ] **Step 3: 失败测试 + 实现——showReport**

```ts
test('show returns entry metadata and artifact content; unknown name exits 1', async () => {
  const hit = await showReport(fakeCtx(), { source, target: uninitTarget, name: 'alpha' })
  expect(hit.ok).toBe(true)
  expect(hit.entry?.description).toBe('甲说明')
  expect(hit.content).toContain('body')
  const miss = await showReport(fakeCtx(), { source, target: uninitTarget, name: 'ghost' })
  expect(miss.ok).toBe(false)
  expect(miss.exitCode).toBe(1)
})
```

实现同 list 的取数路径，单条：catalog 无此名 → fail（消息列出可用名）；产物读不到 → entry.state = 'broken'，content 省略，仍 ok（退 0，与 list 一致不吞错但不失败）。

- [ ] **Step 4: CLI 接线**

- `list` 命令：args `source/tag/grep/json/target(positional)`；`--tag` 走 splitNames；文本输出每行 `name  state?  description`（两空格分隔），`--json` 输出 `{ ok, rows, exitCode }`
- `show <name>`：name 为 required positional；文本输出元数据块（name/description/tags/scope/profiles/state）后跟正文；`--json` 输出 `{ ok, entry, content }`
- `init`：`profile` 改 `required: false`，新增 `rules` option（splitNames）；run 里校验——两者都缺或都给 → `console.error('exactly one of --profile / --rules is required')` 且 `process.exitCode = 2`；rules 路径传 `profile: '-'`
- `update`：删 `include`，加 `add`/`remove`（均 splitNames，描述注明 add 覆盖「新装」与「回补排除」两种情形）
- 主命令 description 更新为含 list/show 的典型流程；subCommands 增加 list/show

- [ ] **Step 5: 全量验证 + 真机烟测 + Commit**

Run: `cd packages/iuse && bun run test && bunx tsc --noEmit && bun run lint`
烟测（真源仓）：`iuse list --source ~/code/infra-ai`、`iuse show constitution --source ~/code/infra-ai`、`iuse list --tag ts --json --source ~/code/infra-ai` 逐条人验输出合理。

```bash
git add packages/iuse
git commit -m "feat(iuse): list/show query commands and composition flags"
```

---

### Task 5: TUI——browse 视图、入口路由、a/x 动作

**Files:**
- Create: `packages/iuse/src/tui/browse-view.tsx`
- Modify: `packages/iuse/src/tui/app.tsx`（路由：未初始化 bare → browse；已初始化 status ↔ browse；browse → init/update 计划流）
- Modify: `packages/iuse/src/tui/status-view.tsx`（available 段展示 + 键提示加 `b 浏览`）
- Modify: `packages/iuse/src/tui/profile-picker.tsx`（保留，由 browse 内 `p` 进入）
- Test: `packages/iuse/tests/tui-browse-flow.test.tsx`（新建）；`tests/tui-init-flow.test.tsx`、`tests/tui-status-flow.test.tsx`（入口路由变化的适配）

**Interfaces:**
- Consumes: Task 4 `listReport/showReport` 的行与内容；Task 3 `runInit({ rules })`、`runUpdate({ add, remove })`；既有 plan-view/progress-view/update-plan-view/diff-view 流程
- Produces: `BrowseView` props：

```tsx
interface BrowseViewProps {
  rows: ListRow[]                       // 已含 state
  contentFor: (name: string) => string  // 右栏正文（App 预取或惰性读）
  initialized: boolean
  onInitRules: (rules: string[]) => void   // 未初始化：space 勾选集 enter 提交
  onAdd: (rule: string) => void            // 已初始化：a
  onRemove: (rule: string) => void         // 已初始化：x
  onPickProfile: () => void                // p 进 profile-picker
  onBack: () => void                       // esc/b 返回（已初始化回 status）
}
```

- [ ] **Step 1: 失败测试——browse 浏览与过滤**

`tests/tui-browse-flow.test.tsx`（整套夹具——fixtureSource 含 catalog.json、fakeCtx、bootApp、press、waitFor、lastFrameForDiag——从 tui-init-flow.test.tsx 复制适配，fixtureSource 需在源仓写入与产物一致的 catalog.json）：

```tsx
test('bare run on uninitialized target lands on browse with rows and right-pane content', async () => {
  const { lastFrame } = bootApp({ ctx: fakeCtx(), target: uninitTarget, source })
  await waitFor(() => (lastFrame() ?? '').includes('constitution'))
  expect(lastFrame()).toContain('浏览')       // 视图标题
  expect(lastFrame()).toContain('# Constitution') // 右栏正文（首选中行）
})

test('t cycles tag filter; space selects; enter opens init plan with selected rules', async () => {
  const { lastFrame, stdin } = bootApp({ ctx: fakeCtx(), target: uninitTarget, source })
  await waitFor(() => (lastFrame() ?? '').includes('constitution'))
  await press(stdin, ' ')
  await waitFor(() => (lastFrame() ?? '').includes('[x]'))
  await press(stdin, '\r')
  await waitFor(() => (lastFrame() ?? '').includes('计划预览'))
  expect(lastFrame()).toContain('copy-rule')
})

test('initialized target: status b enters browse; a on available rule reaches update plan', async () => {
  const target = await initTargetWithAllStates(source) // extra 为 available
  const { lastFrame, stdin } = bootApp({ ctx: fakeCtx(), target, source })
  await waitFor(() => (lastFrame() ?? '').includes('constitution'))
  await press(stdin, 'b')
  await waitFor(() => (lastFrame() ?? '').includes('浏览'))
  // 移动到 extra 行后按 a
  await press(stdin, '[B')
  ...
  await press(stdin, 'a')
  await waitFor(() => (lastFrame() ?? '').includes('update 计划预览'))
  expect(lastFrame()).toContain('add')
})
```

Run → FAIL

- [ ] **Step 2: 实现 browse-view.tsx**

左右分屏用 ink `<Box>` flexDirection="row"：左栏固定宽 32（列表：光标 `>`、勾选 `[x]`、state 着色沿用 status-view 的映射，excluded dimmed），右栏 flexGrow 1（description、tags 行、正文按 diff-view 的 200 行截断策略）。useInput：上下移动、`t` 循环 tag 面（`无过滤 -> 各 facet 依序 -> 回到无过滤`，当前 facet 名显示在标题行）、未初始化 `space`/`enter`、已初始化 `a`（仅 available/uninstalled 行有效）/`x`（仅已装行有效）、`p`、`q` 退出、esc onBack。

- [ ] **Step 3: app.tsx 路由改造**

- 未初始化 bare：bootstrap 后进 `browse`（数据来自 listReport + 逐条 readTextIfExists 预取正文）；`p` 切 profile-picker（原流程保留）；browse 的 onInitRules → 现有 init 计划流（runInit dryRun with rules → plan-view → execute）
- 已初始化 bare：status 起步；`b` → browse；onAdd/onRemove → runUpdate dryRun（add/remove 单条）→ update-plan-view 既有裁决/执行流 → 完成回刷新的 status
- update-plan-view 内旧 `--include` 术语随 Task 3 改名调整文案（`回补`→`加入` 提示按实际 op）

- [ ] **Step 4: 适配既有 TUI 测试**

- `tui-init-flow.test.tsx`：bare 进 browse 后，profile-picker 相关用例在首个 waitFor 前插 `await press(stdin, 'p')`；首帧断言从 picker 文案改为 browse 文案
- `tui-status-flow.test.tsx`：available 行断言从 `outdated` 改 `available`；fixtureSource 补写 catalog.json（browse 数据源）
- 全套跑三遍防 flake：`for i in 1 2 3; do bun run test || break; done`

- [ ] **Step 5: 全量验证 + 真机烟测 + Commit**

Run: `cd packages/iuse && bun run test && bunx tsc --noEmit && bun run lint`
真机：在一个临时目录跑 `iuse`（TTY）走一遍 browse → 勾选 → init 计划；在已初始化目标跑 `iuse` → b → a/x 流。

```bash
git add packages/iuse
git commit -m "feat(iuse): browse view with split pane, entry routing, add/remove actions"
```

---

## 收尾

1. 仓库根 `pnpm meta status` 退 0（catalog 新鲜）
2. 三包 `bun run test && bunx tsc --noEmit && bun run lint` 全绿
3. push 后 `gh run watch` 至 CI 绿
4. 最终 whole-branch review（subagent-driven-development 的 final review 流程）

## Self-Review 记录

- Spec 覆盖：决策一（Task 1+2）、决策二（Task 3）、命令面（Task 4）、TUI（Task 5）、错误处理（catalog 缺失/broken/互斥旗标分布于 Task 4 各步、unknown add/remove 于 Task 3）、测试策略逐层落实；「实施切分建议」五条一一对应
- 类型一致性：CatalogRule/Catalog 在 Task 2 定义、Task 4 消费同名；assembleRules 三处消费（report/update/init）签名一致；DriftState 扩展仅 'available'（'uninstalled'/'broken' 是 ListRow 专属扩展，不进 DriftState）
- 已知风险：Task 5 入口路由改变会牵动全部既有 TUI 用例，Step 4 已显式列为工作项；update.ts 重构量最大，Task 3 Step 6 给了逐条改动锚点
