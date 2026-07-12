# 确定性校验替代 AI 语义 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 `docs/superpowers/specs/2026-07-12-deterministic-checks-design.md`，把八处判据明确的检查代码化：产物契约校验、上游查重前置、writeback 有效性、target 字段退役、skills.json schema、改动集防线、prompt 红线测试。

**Architecture:** 校验谓词按归属安放——类别专属进 `kinds.ts`（verifyArtifact/preBuildCheck）、动作级进 `actions.ts`（writeback 收尾、buildOne 前置与快照）、登记层进 `registry.ts`（schema）、文档守卫进测试。全部经注入（fetchJson/run/claude）可单测。

**Tech Stack:** 既有栈，无新依赖（fetchJson 用运行时全局 fetch）。

## Global Constraints

- 包管理 pnpm；运行与测试 bun（`bun test` 于 `packages/meta-cli/`）
- 源代码禁止 emoji；禁止 `@ts-ignore`；禁止双重断言；禁止 `!` 非空断言；文件名 kebab-case
- commit message 英文，Conventional Commits
- 每任务提交前：full `bun test` + `pnpm --filter @infra-ai/meta-cli typecheck` + `pnpm --filter @infra-ai/meta-cli lint`（零 warning）
- 测试临时目录 `mkdtempSync(join(tmpdir(), 'meta-cli-'))`，测后清理；外部效应（fetch/git/claude）一律注入 fake，测试不打真实网络
- spec 红线：`fetchJson` 网络失败时查重报失败不静默跳过；改动集防线的 git 失败同样报失败
- 既有接口（本计划消费）：`KINDS: Record<AssetKind, KindDef>`、`MetaAsset { name, kind, status, scope, metaPath, artifactPath }`、`ActionContext { repoRoot, run, now, claude, download }`、`buildOne`（actions.ts 内部）、`writebackAction`、`loadSkills`、`readTextIfExists`/`sha256`（io）、gray-matter

---

### Task 1: rule/template 的 verifyArtifact 谓词

**Files:**
- Modify: `packages/meta-cli/src/core/kinds.ts`（verifyArtifact 签名扩 scope；rule/template 实现）
- Modify: `packages/meta-cli/src/core/claude.ts`（verifyBuild 调用点传 scope——`asset` 本就是 MetaAsset，签名兼容则无改动，确认即可）
- Test: `packages/meta-cli/tests/kinds.test.ts`（追加）

**Interfaces:**
- Produces: `KindDef.verifyArtifact: (repoRoot: string, asset: { name: string; artifactPath: string; scope: string | null }) => string | null`（MetaAsset 结构兼容，调用点零改动）

- [ ] **Step 1: 追加失败测试**

`packages/meta-cli/tests/kinds.test.ts` 追加（import 增加 `mkdirSync, mkdtempSync, rmSync, writeFileSync` 自 node:fs、`tmpdir` 自 node:os）：

```ts
describe('rule verifyArtifact', () => {
  function ruleRepo(artifact: string): string {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    mkdirSync(join(root, 'rules/scoped'), { recursive: true })
    mkdirSync(join(root, 'rules/global'), { recursive: true })
    writeFileSync(join(root, artifact.startsWith('rules/scoped') ? artifact : artifact), '')
    return root
  }
  test('scoped rule requires paths frontmatter matching scope', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      mkdirSync(join(root, 'rules/scoped'), { recursive: true })
      const asset = { name: 'api', artifactPath: 'rules/scoped/api.md', scope: 'src/api/**' }
      writeFileSync(join(root, asset.artifactPath), '---\npaths:\n  - "src/api/**"\n---\nbody\n')
      expect(KINDS.rule.verifyArtifact(root, asset)).toBeNull()
      writeFileSync(join(root, asset.artifactPath), 'no frontmatter\n')
      expect(KINDS.rule.verifyArtifact(root, asset)).toMatch(/paths/u)
      writeFileSync(join(root, asset.artifactPath), '---\npaths:\n  - "src/other/**"\n---\n')
      expect(KINDS.rule.verifyArtifact(root, asset)).toMatch(/paths/u)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('global rule must not carry paths frontmatter', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      mkdirSync(join(root, 'rules/global'), { recursive: true })
      const asset = { name: 'constitution', artifactPath: 'rules/global/constitution.md', scope: 'global' }
      writeFileSync(join(root, asset.artifactPath), '# Constitution\n')
      expect(KINDS.rule.verifyArtifact(root, asset)).toBeNull()
      writeFileSync(join(root, asset.artifactPath), '---\npaths:\n  - "x/**"\n---\n')
      expect(KINDS.rule.verifyArtifact(root, asset)).toMatch(/global/u)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('template verifyArtifact', () => {
  test('requires at least one ALL_CAPS placeholder', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      mkdirSync(join(root, 'templates'), { recursive: true })
      const asset = { name: 'architecture', artifactPath: 'templates/architecture.md', scope: null }
      writeFileSync(join(root, asset.artifactPath), '# X\n\n[PROJECT_NAME] here\n')
      expect(KINDS.template.verifyArtifact(root, asset)).toBeNull()
      writeFileSync(join(root, asset.artifactPath), '# X\nno placeholder\n')
      expect(KINDS.template.verifyArtifact(root, asset)).toMatch(/placeholder/u)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd packages/meta-cli && bun test tests/kinds.test.ts
```

期望：新增两个 describe FAIL（现实现返回 null）。

- [ ] **Step 3: 实现**

`packages/meta-cli/src/core/kinds.ts`：

`KindDef.verifyArtifact` 类型改为
`(repoRoot: string, asset: { name: string; artifactPath: string; scope: string | null }) => string | null`；
删除 `noExtraVerify`，rule/template 分别实现：

```ts
  // rule 条目内：
    verifyArtifact: (repoRoot, asset) => {
      const content = readTextIfExists(join(repoRoot, asset.artifactPath))
      if (content === null) return null // 存在性由通用校验负责
      let data: Record<string, unknown>
      try {
        data = matter(content).data as Record<string, unknown>
      } catch (error) {
        return `rule frontmatter unparseable: ${String(error)}`
      }
      const scoped = asset.scope !== null && asset.scope !== 'global'
      const paths = data.paths
      if (scoped) {
        if (!Array.isArray(paths) || !paths.includes(asset.scope)) {
          return `scoped rule must carry paths frontmatter matching scope '${asset.scope}'`
        }
        return null
      }
      if (paths !== undefined) return 'global rule must not carry paths frontmatter'
      return null
    },
```

```ts
  // template 条目内：
    verifyArtifact: (repoRoot, asset) => {
      const content = readTextIfExists(join(repoRoot, asset.artifactPath))
      if (content === null) return null
      if (!/\[[A-Z][A-Z0-9_]*\]/u.test(content)) {
        return 'template must keep at least one [ALL_CAPS] placeholder'
      }
      return null
    },
```

`claude.ts` 的 `verifyBuild` 调用 `KINDS[asset.kind].verifyArtifact(repoRoot, asset)`——
`MetaAsset` 含 `scope`，结构兼容，确认无需改动。

- [ ] **Step 4: 现有产物守恒确认 + 全量验证 + 提交**

```bash
grep -c 'paths' rules/global/constitution.md; echo "期望 0（global 无 paths）"
grep -cE '\[[A-Z][A-Z0-9_]*\]' templates/architecture.md; echo "期望 >0（模板有占位符）"
bun test && pnpm --filter @infra-ai/meta-cli typecheck && pnpm --filter @infra-ai/meta-cli lint
git add packages/meta-cli
git commit -m "feat(meta-cli): enforce rule paths and template placeholder contracts"
```

---

### Task 2: skill 上游查重前置代码化，撤销 ungh 授权

**Files:**
- Modify: `packages/meta-cli/src/core/kinds.ts`（FetchJson 类型、preBuildCheck）
- Modify: `packages/meta-cli/src/core/actions.ts`（ActionContext.fetchJson、defaultContext、buildOne 前置）
- Modify: `packages/meta-cli/src/core/claude.ts`（无——extraAllowedTools 在 kinds.ts 清空即可；删除 ungh 注释）
- Modify: `meta/prompts/skill-build.md`（删除 AI 查重步骤）
- Test: `packages/meta-cli/tests/kinds.test.ts`、`packages/meta-cli/tests/actions.test.ts`、`packages/meta-cli/tests/claude.test.ts`（skill 白名单断言回归无 ungh）

**Interfaces:**
- Produces:
  - `export type FetchJson = (url: string) => Promise<unknown>`（kinds.ts）
  - `KindDef.preBuildCheck?: (fetchJson: FetchJson, asset: { name: string }) => Promise<string | null>`
  - `ActionContext` 增加 `fetchJson: FetchJson`；`defaultContext` 提供 fetch 默认实现
  - `testContext` fixture 增加 `fetchJson: async () => ({ files: [] })`

- [ ] **Step 1: 追加失败测试**

`packages/meta-cli/tests/kinds.test.ts` 追加：

```ts
describe('skill preBuildCheck', () => {
  const asset = { name: 'commit-lite' }
  test('fails when official catalog has a same-named skill', async () => {
    const fetchJson = async () => ({
      files: [{ path: 'plugins/git-tools/skills/commit-lite/SKILL.md' }, { path: 'plugins/x/README.md' }],
    })
    const err = await KINDS.skill.preBuildCheck?.(fetchJson, asset)
    expect(err).toMatch(/official/u)
  })
  test('fails on external_plugins hit', async () => {
    const fetchJson = async () => ({ files: [{ path: 'external_plugins/commit-lite/manifest.json' }] })
    expect(await KINDS.skill.preBuildCheck?.(fetchJson, asset)).toMatch(/official/u)
  })
  test('passes when no hit', async () => {
    const fetchJson = async () => ({ files: [{ path: 'plugins/other/skills/else/SKILL.md' }] })
    expect(await KINDS.skill.preBuildCheck?.(fetchJson, asset)).toBeNull()
  })
  test('rule and template have no preBuildCheck', () => {
    expect(KINDS.rule.preBuildCheck).toBeUndefined()
    expect(KINDS.template.preBuildCheck).toBeUndefined()
  })
})
```

`packages/meta-cli/tests/claude.test.ts`：skill build 白名单断言回归：

```ts
    expect(allowedToolsFor(skillAsset, 'build')).toBe(
      'Read,Glob,Grep,Write(skills/commit-lite/**),Edit(skills/commit-lite/**)',
    )
```

`packages/meta-cli/tests/actions.test.ts`：`testContext` 增加
`fetchJson: async () => ({ files: [] }),`；追加测试：

```ts
describe('build preBuildCheck gate', () => {
  test('skill build aborts before claude when upstream has the name', async () => {
    const root = fixtureRepo()
    try {
      mkdirSync(join(root, 'meta/skills'), { recursive: true })
      writeFileSync(join(root, 'meta/skills/dup.md'), '---\nname: dup\nstatus: ready\n---\nbody\n')
      let claudeCalled = false
      const claude: ActionContext['claude'] = async () => {
        claudeCalled = true
        return { code: 0, timedOut: false, stderr: '' }
      }
      const fetchJson = async () => ({ files: [{ path: 'plugins/p/skills/dup/SKILL.md' }] })
      const result = await getAction('build').execute(
        testContext(root, { claude, fetchJson }),
        { positionals: ['dup'], flags: {} },
      )
      expect(result.ok).toBe(false)
      expect(result.message).toMatch(/official/u)
      expect(claudeCalled).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('fetch failure fails the build rather than skipping the check', async () => {
    const root = fixtureRepo()
    try {
      mkdirSync(join(root, 'meta/skills'), { recursive: true })
      writeFileSync(join(root, 'meta/skills/dup.md'), '---\nname: dup\nstatus: ready\n---\nbody\n')
      const fetchJson = async () => {
        throw new Error('network down')
      }
      const result = await getAction('build').execute(
        testContext(root, { fetchJson }),
        { positionals: ['dup'], flags: {} },
      )
      expect(result.ok).toBe(false)
      expect(result.message).toMatch(/pre-build check failed/u)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
bun test tests/kinds.test.ts tests/actions.test.ts tests/claude.test.ts
```

期望：preBuildCheck 相关 FAIL；claude.test 白名单断言 FAIL（当前含 ungh）。

- [ ] **Step 3: 实现**

`packages/meta-cli/src/core/kinds.ts`：

```ts
export type FetchJson = (url: string) => Promise<unknown>

const UNGH_OFFICIAL_FILES =
  'https://ungh.cc/repos/anthropics/claude-plugins-official/files/main'
```

`KindDef` 增加 `preBuildCheck?: (fetchJson: FetchJson, asset: { name: string }) => Promise<string | null>`；
skill 条目：`extraAllowedTools: []`（并删除 claude.ts 中关于 ungh 的注释），增加：

```ts
    preBuildCheck: async (fetchJson, asset) => {
      const tree = (await fetchJson(UNGH_OFFICIAL_FILES)) as { files?: { path?: unknown }[] }
      const files = Array.isArray(tree.files) ? tree.files : []
      const hit = files.find((f) => {
        const parts = (typeof f.path === 'string' ? f.path : '').split('/')
        return (
          (parts[0] === 'plugins' && parts[2] === 'skills' && parts[3] === asset.name) ||
          (parts[0] === 'external_plugins' && parts[1] === asset.name)
        )
      })
      return hit
        ? `official catalog already has '${asset.name}': record it as official in skills.json instead of building`
        : null
    },
```

`packages/meta-cli/src/core/actions.ts`：

- `ActionContext` 增加 `fetchJson: FetchJson`（import type 自 './kinds'）
- `defaultContext` 增加：

```ts
    fetchJson: async (url) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`)
      return res.json()
    },
```

- `buildOne` 在 `ctx.claude(...)` 之前插入：

```ts
  const pre = KINDS[asset.kind].preBuildCheck
  if (pre) {
    let preErr: string | null
    try {
      preErr = await pre(ctx.fetchJson, asset)
    } catch (error) {
      preErr = `pre-build check failed: ${String(error)}`
    }
    if (preErr) return preErr
  }
```

（actions.ts 需 `import { KINDS } from './kinds'`。）

`meta/prompts/skill-build.md`：步骤 2（核实上游 WebFetch ungh 整段）删除并重排编号；
在文档开头「你在为本仓构建…」段落后追加一句：
`同名查重已在你启动前由外壳完成——走到这里说明官方目录没有同名 skill，直接生成即可。`

- [ ] **Step 4: 验证并提交**

```bash
grep -n 'ungh\|WebFetch' meta/prompts/skill-build.md packages/meta-cli/src/core/claude.ts ; echo "---期望无输出---"
bun test && pnpm --filter @infra-ai/meta-cli typecheck && pnpm --filter @infra-ai/meta-cli lint
git add packages/meta-cli meta/prompts/skill-build.md
git commit -m "feat(meta-cli): move upstream duplicate check into code, drop ungh grant

The same-name check against the official plugin catalog runs in
buildOne before spawning claude (injectable fetchJson, fail-closed on
network errors). The skill build sandbox loses its WebFetch grant;
semantic same-purpose dedup is abandoned per spec."
```

---

### Task 3: writeback 有效性校验

**Files:**
- Modify: `packages/meta-cli/src/core/actions.ts`（writebackAction 收尾）
- Test: `packages/meta-cli/tests/actions.test.ts`（追加）

**Interfaces:**
- Consumes: `sha256`/`readTextIfExists`（io，actions.ts 已 import 或补）、gray-matter（`import matter from 'gray-matter'` 补入 actions.ts）

- [ ] **Step 1: 追加失败测试**

`packages/meta-cli/tests/actions.test.ts` 的 writeback describe 追加
（fixture：syncLock 后手改产物制造 dirty，与既有 writeback 测试一致）：

```ts
  test('no-op writeback fails; frontmatter tampering fails; scope change allowed', async () => {
    const root = fixtureRepo()
    try {
      syncLock(root)
      writeFileSync(join(root, 'rules/global/foo.md'), '# edited\n')
      const metaPath = join(root, 'meta/rules/foo.md')

      const noop: ActionContext['claude'] = async () => ({ code: 0, timedOut: false, stderr: '' })
      const r1 = await getAction('writeback').execute(testContext(root, { claude: noop }), {
        positionals: ['foo'],
        flags: {},
      })
      expect(r1.ok).toBe(false)
      expect(r1.message).toMatch(/no change/u)

      const tamper: ActionContext['claude'] = async () => {
        writeFileSync(metaPath, '---\nname: renamed\nstatus: ready\nscope: global\n---\nbody\n')
        return { code: 0, timedOut: false, stderr: '' }
      }
      const r2 = await getAction('writeback').execute(testContext(root, { claude: tamper }), {
        positionals: ['foo'],
        flags: {},
      })
      expect(r2.ok).toBe(false)
      expect(r2.message).toMatch(/frontmatter/u)

      const scopeChange: ActionContext['claude'] = async () => {
        writeFileSync(metaPath, '---\nname: foo\nstatus: ready\nscope: "src/**"\n---\nbody updated\n')
        return { code: 0, timedOut: false, stderr: '' }
      }
      const r3 = await getAction('writeback').execute(testContext(root, { claude: scopeChange }), {
        positionals: ['foo'],
        flags: {},
      })
      expect(r3.ok).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
```

（注意：每次 writeback 调用前产物须仍为 dirty——本用例中产物始终是手改后的
`# edited`，lock 未更新，三次调用都满足 dirty 前置。）

- [ ] **Step 2: 跑测试确认失败**

```bash
bun test tests/actions.test.ts
```

期望：新测试三段中前两段 FAIL（现在无校验，空跑/篡改都返回 ok）。

- [ ] **Step 3: 实现**

`packages/meta-cli/src/core/actions.ts` 的 `writebackAction.execute`：

在调用 `ctx.claude` 之前记录：

```ts
    const metaAbs = join(ctx.repoRoot, asset.metaPath)
    const before = readTextIfExists(metaAbs) ?? ''
```

claude 成功返回（timedOut/code 检查之后）追加：

```ts
    const after = readTextIfExists(metaAbs) ?? ''
    if (sha256(after) === sha256(before)) {
      return fail(`${name}: writeback made no change to the meta instruction`)
    }
    const fmBefore = matter(before).data as Record<string, unknown>
    const fmAfter = matter(after).data as Record<string, unknown>
    for (const key of new Set([...Object.keys(fmBefore), ...Object.keys(fmAfter)])) {
      if (asset.kind === 'rule' && key === 'scope') continue
      if (JSON.stringify(fmBefore[key]) !== JSON.stringify(fmAfter[key])) {
        return fail(`${name}: writeback modified frontmatter field '${key}'`)
      }
    }
```

（actions.ts 补 `import matter from 'gray-matter'`、`join` 已有、
`readTextIfExists`/`sha256` 从 './io' 补齐 import。）

- [ ] **Step 4: 验证并提交**

```bash
bun test && pnpm --filter @infra-ai/meta-cli typecheck && pnpm --filter @infra-ai/meta-cli lint
git add packages/meta-cli/src/core/actions.ts packages/meta-cli/tests/actions.test.ts
git commit -m "feat(meta-cli): validate writeback made a real, frontmatter-safe change"
```

---

### Task 4: target 字段退役 + skills.json schema + prompt 红线测试

**Files:**
- Modify: `meta/rules/constitution.md`、`meta/rules/python.md`、`meta/rules/typescript.md`、`meta/skills/commit-lite.md`、`meta/templates/architecture.md`（各删 `target:` 行）
- Modify: `meta/README.md`（格式说明删 target 行）
- Modify: `packages/meta-cli/src/core/registry.ts`（loadSkills schema）
- Test: `packages/meta-cli/tests/registry.test.ts`（追加）、Create: `packages/meta-cli/tests/prompts.test.ts`

**Interfaces:**
- Consumes: `RegistryError`（registry.ts 既有）
- 注意：删 target 行改变元指令 hash——commit-lite（synced）会转 stale，这是预期；Task 5 的真实构建验收顺带收敛它

- [ ] **Step 1: 写失败测试**

`packages/meta-cli/tests/registry.test.ts` 追加：

```ts
describe('skills schema', () => {
  test('mirror entries require repo, path and commit', () => {
    const root = tmpRoot()
    try {
      writeFileSync(
        join(root, 'skills.json'),
        `${JSON.stringify([{ name: 'm', source: 'mirror', repo: 'r/x' }])}\n`,
      )
      expect(() => loadSkills(root)).toThrow(/mirror 'm' requires/u)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('invalid source and empty name are rejected', () => {
    const root = tmpRoot()
    try {
      writeFileSync(join(root, 'skills.json'), `${JSON.stringify([{ name: '', source: 'custom' }])}\n`)
      expect(() => loadSkills(root)).toThrow(RegistryError)
      writeFileSync(join(root, 'skills.json'), `${JSON.stringify([{ name: 'x', source: 'weird' }])}\n`)
      expect(() => loadSkills(root)).toThrow(/invalid source/u)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
```

`packages/meta-cli/tests/prompts.test.ts` 全文：

```ts
import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = join(import.meta.dir, '..', '..', '..')
const PROMPTS_DIR = join(REPO_ROOT, 'meta', 'prompts')

// 只用精确短语：宽泛词（如「触发」）会命中领域词造成误报
const PROCESS_PHRASES = ['上账', 'imeta ', 'TUI', 'make ', '对 Claude 说']

describe('prompt documents', () => {
  test('stay free of process phrases (AI-only content red line)', () => {
    const files = readdirSync(PROMPTS_DIR).filter((f) => f.endsWith('.md'))
    expect(files.length).toBeGreaterThanOrEqual(6)
    for (const file of files) {
      const content = readFileSync(join(PROMPTS_DIR, file), 'utf8')
      for (const phrase of PROCESS_PHRASES) {
        expect(content.includes(phrase), `${file} contains process phrase '${phrase}'`).toBe(false)
      }
    }
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
bun test tests/registry.test.ts tests/prompts.test.ts
```

期望：schema 两条 FAIL（现无校验）；prompts 测试应直接 PASS（它是回归门）。

- [ ] **Step 3: 实现 schema 并删 target**

`packages/meta-cli/src/core/registry.ts` 的 `loadSkills` 改为：

```ts
const SKILL_SOURCES = new Set(['custom', 'mirror', 'official'])

export function loadSkills(repoRoot: string): SkillEntry[] {
  const skills = parseJsonFile<SkillEntry[]>(repoRoot, 'skills.json')
  if (skills === null) throw new RegistryError('skills.json: file not found')
  for (const entry of skills) {
    if (typeof entry.name !== 'string' || entry.name === '') {
      throw new RegistryError('skills.json: entry with missing or empty name')
    }
    if (!SKILL_SOURCES.has(entry.source)) {
      throw new RegistryError(`skills.json: ${entry.name}: invalid source '${String(entry.source)}'`)
    }
    if (entry.source === 'mirror' && (!entry.repo || !entry.path || !entry.commit)) {
      throw new RegistryError(`skills.json: mirror '${entry.name}' requires repo, path and commit`)
    }
  }
  return skills
}
```

删除 target 行（五份元指令 + README 格式块）：

```bash
perl -ni -e 'print unless /^target: /' meta/rules/constitution.md meta/rules/python.md meta/rules/typescript.md meta/skills/commit-lite.md meta/templates/architecture.md
perl -ni -e 'print unless /^target: rule \| skill \| template$/' meta/README.md
grep -rn '^target:' meta/ ; echo "---期望无输出---"
```

- [ ] **Step 4: 验证并提交**

```bash
bun test && pnpm --filter @infra-ai/meta-cli typecheck && pnpm --filter @infra-ai/meta-cli lint
cd /Users/xiu/code/infra-ai && imeta status; echo "exit=$?"
```

期望：commit-lite 因元指令 hash 变化显示 stale（预期，Task 5 收敛）；退出码 1。

```bash
git add packages/meta-cli meta/rules meta/skills/commit-lite.md meta/templates/architecture.md meta/README.md
git commit -m "feat(meta-cli): validate skills.json schema, retire dead target field

The target frontmatter field was never read by code (directory is the
kind SSoT); parsing stays tolerant of leftovers. commit-lite goes stale
from the meta hash change and reconverges in the next build."
```

---

### Task 5: 构建改动集第二防线 + 真实构建收敛验收

**Files:**
- Modify: `packages/meta-cli/src/core/actions.ts`（buildOne 快照防线）
- Test: `packages/meta-cli/tests/actions.test.ts`（追加）

**Interfaces:**
- Consumes: `ctx.run: CommandRunner`（既有）、`KINDS[kind].writableGlob`
- 防线语义（含已知局限，写进实现注释）：比较 spawn 前后 `git status --porcelain`
  的行集合，新出现的行必须以 `writableGlob` 的目录前缀开头；claude 改动一个
  构建前就已 dirty 的文件不会产生新行、检测不到——接受并注释说明

- [ ] **Step 1: 追加失败测试**

`packages/meta-cli/tests/actions.test.ts` 追加：

```ts
describe('build changeset guard', () => {
  function seqRunner(outputs: string[]): ActionContext['run'] {
    let call = 0
    return async () => ({ code: 0, stdout: outputs[Math.min(call++, outputs.length - 1)] ?? '', stderr: '' })
  }
  test('out-of-scope changes fail the build', async () => {
    const root = fixtureRepo()
    try {
      const claude: ActionContext['claude'] = async () => {
        mkdirSync(join(root, 'rules/global'), { recursive: true })
        writeFileSync(join(root, 'rules/global/foo.md'), '# built\n')
        return { code: 0, timedOut: false, stderr: '' }
      }
      const run = seqRunner(['', ' M rules/global/foo.md\n?? evil.txt\n'])
      const result = await getAction('build').execute(testContext(root, { claude, run }), {
        positionals: ['foo'],
        flags: {},
      })
      expect(result.ok).toBe(false)
      expect(result.message).toMatch(/outside the build sandbox/u)
      expect(result.message).toMatch(/evil\.txt/u)
      expect(existsSync(join(root, 'artifacts.lock.json'))).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('in-scope changes pass; pre-existing dirt is ignored', async () => {
    const root = fixtureRepo()
    try {
      const claude: ActionContext['claude'] = async () => {
        mkdirSync(join(root, 'rules/global'), { recursive: true })
        writeFileSync(join(root, 'rules/global/foo.md'), '# built\n')
        return { code: 0, timedOut: false, stderr: '' }
      }
      const run = seqRunner([' M unrelated.md\n', ' M unrelated.md\n?? rules/global/foo.md\n'])
      const result = await getAction('build').execute(testContext(root, { claude, run }), {
        positionals: ['foo'],
        flags: {},
      })
      expect(result.ok).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('git failure fails closed', async () => {
    const root = fixtureRepo()
    try {
      const run: ActionContext['run'] = async () => ({ code: 128, stdout: '', stderr: 'not a repo' })
      const result = await getAction('build').execute(testContext(root), {
        positionals: ['foo'],
        flags: {},
      })
      expect(result.ok).toBe(false)
      expect(result.message).toMatch(/changeset guard/u)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
```

（注意既有 build 测试用 testContext 默认 run——返回 code 0 空输出，
快照恒空、防线恒过，既有测试无需改动。）

- [ ] **Step 2: 跑测试确认失败**

```bash
bun test tests/actions.test.ts
```

期望：三条 FAIL（buildOne 尚无防线）。

- [ ] **Step 3: 实现**

`packages/meta-cli/src/core/actions.ts`（buildOne 上方）：

```ts
async function statusSnapshot(ctx: ActionContext): Promise<Set<string> | string> {
  const res = await ctx.run('git', ['status', '--porcelain'], { cwd: ctx.repoRoot })
  if (res.code !== 0) return `changeset guard: git status failed: ${res.stderr}`
  return new Set(res.stdout.split('\n').filter((line) => line !== ''))
}
```

`buildOne` 中（preBuildCheck 之后、`ctx.claude` 之前）：

```ts
  const before = await statusSnapshot(ctx)
  if (typeof before === 'string') return before
```

claude 成功（timedOut/code 检查之后、verifyBuild 之前）：

```ts
  const after = await statusSnapshot(ctx)
  if (typeof after === 'string') return after
  const prefix = KINDS[asset.kind].writableGlob(asset.name).replace(/\*.*$/u, '')
  // 局限：claude 改动一个构建前就已 dirty 的文件不会产生新行，检测不到；
  // 该防线是 allowedTools 沙箱之外的第二道，不是唯一依赖
  const escaped = [...after]
    .filter((line) => !before.has(line))
    .map((line) => line.slice(3))
    .filter((path) => !path.startsWith(prefix))
  if (escaped.length > 0) {
    return `changeset guard: files changed outside the build sandbox: ${escaped.join(', ')}`
  }
```

- [ ] **Step 4: 全量验证 + 真实构建收敛（Task 4 遗留的 stale）**

```bash
bun test && pnpm --filter @infra-ai/meta-cli typecheck && pnpm --filter @infra-ai/meta-cli lint
cd /Users/xiu/code/infra-ai && imeta build commit-lite; echo "exit=$?"
imeta status; echo "exit=$?"
```

期望：真实构建成功（顺带实战 preBuildCheck 真 ungh 调用、改动集防线、
新 verify 链）；构建后 commit-lite 回 synced。查 run log 确认无越界与查重痕迹：

```bash
LOG=.imeta/logs/$(ls -t .imeta/logs | head -1); jq -r '.step' "$LOG" | sort | uniq -c
```

- [ ] **Step 5: 提交**

```bash
git add packages/meta-cli artifacts.lock.json skills/commit-lite
git commit -m "feat(meta-cli): add changeset guard as second build sandbox line"
```

---

## Self-Review 记录

- Spec 覆盖：Decision 1（Task 2）、2（Task 1 rule）、3（Task 1 template）、4（Task 3）、
  5（Task 4 删 target + README）、6（Task 4 schema）、7（Task 5）、8（Task 4 prompts.test）；
  Error Handling 两条（Task 2 fetch fail-closed 测试、Task 5 git fail-closed 测试）。
- 类型一致性：`FetchJson`/`preBuildCheck`/`verifyArtifact` 扩展签名在 kinds/claude/actions/
  测试间一致；`testContext` 增量字段（fetchJson）与 Task 2/3/5 的用法一致。
- 顺序依赖：Task 4 删 target 使 commit-lite 转 stale，由 Task 5 的真实构建收敛——
  两任务的验证步骤互相衔接，计划内已写明。
- 已知局限如实入注释：改动集防线检测不到「构建前已 dirty 的文件被 claude 再改」。
