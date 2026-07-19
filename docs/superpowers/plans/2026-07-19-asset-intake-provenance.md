# 资产引入规则与两层溯源 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 溯源两层化(refUrl 参考来源 + install 实际来源)、`imeta links` 链接健康检查、asset-intake AI 契约。

**Architecture:** schema 层给 SkillEntry 与 rule 元指令 frontmatter 加 refUrl(管理元数据,不进 hash/catalog);links 作为注册表 query 动作,经可注入 fetchStatus 判定 broken/moved/ok/unreachable;intake 流程是 meta/prompts 下的 AI 行为契约文档。

**Tech Stack:** Bun + TypeScript,零新依赖。

**Spec:** `docs/superpowers/specs/2026-07-19-asset-intake-provenance-design.md`(一切以 spec 为准)

## Global Constraints

- 文件与目录 kebab-case;源代码禁 emoji;commit 英文 Conventional Commits
- commit trailer:`Claude-Session: https://claude.ai/code/session_014qFwy6t5VhLF85toupsepd`
- 禁 `!` 非空断言、`@ts-ignore`、双重断言;oxlint + `bunx tsc --noEmit` 全绿
- `refUrl` MUST NOT 进 `metaContentHash` 的 kept、MUST NOT 进 catalog
- links 动作只报不改;测试注入 fake fetchStatus,不打真网
- meta-cli 新动作先进 `src/core/actions.ts` 注册表再接 `src/tui/keymap.ts`;`tests/parity.test.ts` 不过不得提交
- 每 task 测试先行(Red-Green),完成即 commit

## 现有契约速览

- `packages/meta-cli/src/core/registry.ts`:`SkillEntry { name, source, repo?, path?, commit?, updated?, url? }`(url 是上一轮加的,本波改名)
- `packages/meta-cli/src/core/meta.ts`:`MetaAsset`、`parseMetaFile`、`metaContentHash`(kept 仅 name/status/scope)
- `packages/meta-cli/src/core/actions.ts`:`ActionContext { repoRoot, run, now, claude, download, fetchJson, spawnDetached }`、`ActionDef`、`ACTIONS` 数组、`fail()` helper;keymap 已占键 assets: a/b/w/v/g,skills: f/u
- `packages/meta-cli/src/core/catalog.ts`:`buildCatalog` 从 MetaAsset 取字段——确认不要把 refUrl 加进去
- 契约文档先例:`meta/prompts/rule-build.md` 等,格式参考;`meta/README.md` 记 frontmatter 字段说明

---

### Task 1: 溯源 schema(refUrl/install 字段 + 迁移 + 文档)

**Files:**
- Modify: `packages/meta-cli/src/core/registry.ts`(SkillEntry:url→refUrl,加 install)
- Modify: `packages/meta-cli/src/core/meta.ts`(MetaAsset.refUrl + parseMetaFile)
- Modify: `skills.json`(ai-sdk 条目 url→refUrl)
- Modify: `SKILLS.md`(schema 说明:refUrl/install 两层溯源,替换上一轮的 url 段落)
- Modify: `meta/README.md`(rule frontmatter 字段说明加 refUrl)
- Test: `packages/meta-cli/tests/meta.test.ts`(追加)

**Interfaces:**
- Produces(Task 2 依赖):`SkillEntry.refUrl?: string`、`SkillEntry.install?: string`、`MetaAsset.refUrl: string`(缺省空串)

- [ ] **Step 1: 失败测试**

tests/meta.test.ts 追加:

```ts
test('parseMetaFile reads refUrl as management metadata outside the content hash', () => {
  const withRef = parseMetaFile(
    '---\nname: demo\nstatus: ready\nscope: global\ndescription: x\nrefUrl: https://example.com/doc\ntags: [core]\n---\nbody',
    'demo.md',
    'rule',
  )
  expect(withRef.refUrl).toBe('https://example.com/doc')
  const without = parseMetaFile('---\nname: demo2\nstatus: ready\n---\nbody', 'demo2.md', 'rule')
  expect(without.refUrl).toBe('')

  const a = metaContentHash('---\nname: d\nstatus: ready\nscope: global\n---\nbody')
  const b = metaContentHash('---\nname: d\nstatus: ready\nscope: global\nrefUrl: https://x\n---\nbody')
  expect(a).toBe(b)
})
```

Run: `cd packages/meta-cli && bun test tests/meta.test.ts` → FAIL

- [ ] **Step 2: 实现**

- meta.ts:`MetaAsset` 加 `refUrl: string`;parseMetaFile 返回对象加 `refUrl: typeof data.refUrl === 'string' ? data.refUrl.trim() : ''`;`metaContentHash` 不动
- registry.ts:`SkillEntry` 的 `url?: string` 改为 `refUrl?: string`,并加 `install?: string`;全仓 `grep -rn "\.url" packages/meta-cli/src packages/iuse/src` 确认无其他 url 消费点(上一轮只加了字段没有消费逻辑)
- skills.json:ai-sdk 条目键 `url` 改 `refUrl`(值不变)
- 因 MetaAsset 加宽,既有测试 fixture 若需补字段按 description 那轮先例最小调整
- 确认 catalog.ts 的 buildCatalog 未引用 refUrl(不加)

- [ ] **Step 3: 文档**

- SKILLS.md:把上一轮「任何条目均可带 `url`…」段替换为两层溯源说明:`refUrl` 参考来源(官方权威指导页,`imeta links` 检查其健康);`install` 实际来源为命令/目录时记录(仅记录不执行);mirror 的实际来源仍是 repo/path/commit
- meta/README.md:rule frontmatter 字段说明加一行 `refUrl`(可选,参考来源链接,管理元数据不进 hash;人读来源叙述仍写正文首段)

- [ ] **Step 4: 全量验证 + Commit**

Run: `cd packages/meta-cli && bun run test && bunx tsc --noEmit && bun run lint && cd ../iuse && bun run test && bunx tsc --noEmit`(iuse 消费 meta-cli 类型,须同过)
仓库根 `pnpm meta status` 退 0。

```bash
git add packages/meta-cli packages/iuse skills.json SKILLS.md meta/README.md
git commit -m "feat(meta): two-layer provenance fields refUrl and install"
```

---

### Task 2: imeta links 动作

**Files:**
- Modify: `packages/meta-cli/src/core/actions.ts`(ActionContext 加 fetchStatus;新 linksAction 进 ACTIONS)
- Modify: `packages/meta-cli/src/tui/keymap.ts`(`{ actionId: 'links', view: 'assets', key: 'l' }`)
- Test: `packages/meta-cli/tests/links.test.ts`(新建)

**Interfaces:**
- Consumes: Task 1 的 `SkillEntry.refUrl`、`MetaAsset.refUrl`
- Produces:

```ts
// ActionContext 追加:
fetchStatus: (url: string) => Promise<{ status: number; location?: string }>
// defaultContext 默认实现:
fetchStatus: async (url) => {
  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000) })
  const location = res.headers.get('location')
  return location === null ? { status: res.status } : { status: res.status, location }
},

// links 判定(纯函数,导出便于单测):
export type LinkVerdict = 'ok' | 'broken' | 'moved' | 'unreachable'
export interface LinkRow { asset: string; refUrl: string; verdict: LinkVerdict; location?: string }
```

- [ ] **Step 1: 失败测试**

tests/links.test.ts(fixture:mkdtemp 仓含 skills.json 一条带 refUrl、meta/rules 一条 frontmatter 带 refUrl;fake fetchStatus 按 url 返回预设):

```ts
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ACTIONS, defaultContext } from '../src/core/actions'

function fixtureRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'imeta-links-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  writeFileSync(join(dir, 'skills.json'), JSON.stringify([
    { name: 'sk-broken', source: 'official', repo: 'x/y', refUrl: 'https://gone.example/doc' },
    { name: 'sk-moved', source: 'official', repo: 'x/z', refUrl: 'https://old.example/doc' },
    { name: 'sk-plain', source: 'custom' },
  ]))
  writeFileSync(join(dir, 'meta', 'rules', 'r1.md'),
    '---\nname: r1\nstatus: ready\nscope: global\ndescription: x\nrefUrl: https://ok.example/doc\ntags: [core]\n---\nbody')
  return dir
}

function findLinks() {
  const action = ACTIONS.find((a) => a.id === 'links')
  if (action === undefined) throw new Error('links action not registered')
  return action
}

function ctxWith(repoRoot: string, responses: Record<string, { status: number; location?: string } | 'throw'>) {
  return {
    ...defaultContext(repoRoot),
    fetchStatus: async (url: string) => {
      const r = responses[url]
      if (r === undefined) throw new Error(`unexpected url ${url}`)
      if (r === 'throw') throw new Error('network down')
      return r
    },
  }
}

describe('links action', () => {
  test('classifies broken/moved/ok and exits 1 when any needs update', async () => {
    const repo = fixtureRepo()
    const result = await findLinks().execute(ctxWith(repo, {
      'https://gone.example/doc': { status: 404 },
      'https://old.example/doc': { status: 301, location: 'https://new.example/doc' },
      'https://ok.example/doc': { status: 200 },
    }), { positionals: [], flags: {} })
    expect(result.exitCode).toBe(1)
    const rows = (result.data as { rows: Array<{ asset: string; verdict: string; location?: string }> }).rows
    expect(rows.find((r) => r.asset.includes('sk-broken'))?.verdict).toBe('broken')
    expect(rows.find((r) => r.asset.includes('sk-moved'))?.verdict).toBe('moved')
    expect(rows.find((r) => r.asset.includes('sk-moved'))?.location).toBe('https://new.example/doc')
    expect(rows.find((r) => r.asset.includes('r1'))?.verdict).toBe('ok')
    expect(result.message).toContain('参考来源需更新')
    expect(result.message).toContain('https://gone.example/doc')
  })

  test('unreachable is a warning, not a failure', async () => {
    const repo = fixtureRepo()
    const result = await findLinks().execute(ctxWith(repo, {
      'https://gone.example/doc': 'throw',
      'https://old.example/doc': { status: 200 },
      'https://ok.example/doc': { status: 200 },
    }), { positionals: [], flags: {} })
    expect(result.exitCode ?? 0).toBe(0)
    const rows = (result.data as { rows: Array<{ asset: string; verdict: string }> }).rows
    expect(rows.find((r) => r.asset.includes('sk-broken'))?.verdict).toBe('unreachable')
  })

  test('no refUrl anywhere yields clean empty run', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'imeta-links-empty-'))
    mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
    const result = await findLinks().execute(ctxWith(dir, {}), { positionals: [], flags: {} })
    expect(result.ok).toBe(true)
    expect(result.exitCode ?? 0).toBe(0)
  })
})
```

Run → FAIL(fetchStatus 不在 ActionContext、links 未注册)

- [ ] **Step 2: 实现**

- ActionContext 加 `fetchStatus`(签名与默认实现见 Interfaces;defaultContext 补齐)
- 判定纯函数:

```ts
export function classifyLinkStatus(status: number): 'ok' | 'broken' | 'moved' {
  if (status === 404 || status === 410) return 'broken'
  if (status === 301 || status === 308) return 'moved'
  return 'ok'
}
```

- linksAction:

```ts
const linksAction: ActionDef = {
  id: 'links',
  summary: 'Check refUrl health for all assets (network)',
  kind: 'query',
  args: [],
  async execute(ctx) {
    const targets: Array<{ asset: string; refUrl: string }> = []
    for (const entry of loadSkills(ctx.repoRoot)) {
      if (entry.refUrl !== undefined) targets.push({ asset: `skill:${entry.name}`, refUrl: entry.refUrl })
    }
    for (const asset of discoverAssets(ctx.repoRoot)) {
      if (asset.refUrl !== '') targets.push({ asset: `${asset.kind}:${asset.name}`, refUrl: asset.refUrl })
    }
    const rows: LinkRow[] = []
    for (const t of targets) {
      try {
        const res = await ctx.fetchStatus(t.refUrl)
        const verdict = classifyLinkStatus(res.status)
        rows.push(verdict === 'moved' && res.location !== undefined
          ? { ...t, verdict, location: res.location }
          : { ...t, verdict })
      } catch {
        rows.push({ ...t, verdict: 'unreachable' })
      }
    }
    const needsUpdate = rows.filter((r) => r.verdict === 'broken' || r.verdict === 'moved')
    const lines = rows.map((r) => {
      if (r.verdict === 'broken') return `${r.asset}: 参考来源需更新 (404/410) ${r.refUrl}`
      if (r.verdict === 'moved') return `${r.asset}: 参考来源需更新 (moved) ${r.refUrl} -> ${r.location ?? '?'}`
      if (r.verdict === 'unreachable') return `${r.asset}: unreachable (network), skipped ${r.refUrl}`
      return `${r.asset}: ok`
    })
    return {
      ok: true,
      message: lines.length > 0 ? lines.join('\n') : 'no refUrl recorded yet',
      data: { rows },
      exitCode: needsUpdate.length > 0 ? 1 : 0,
    }
  },
}
```

加入 ACTIONS;keymap 加 `{ actionId: 'links', view: 'assets', key: 'l' }`。跑 Step 1 测试与 parity 至绿。

- [ ] **Step 3: 全量验证 + Commit**

Run: `cd packages/meta-cli && bun run test && bunx tsc --noEmit && bun run lint`;真机 `pnpm meta links`(打真网,ai-sdk 与 r1 无——当前只有 ai-sdk 一条 refUrl,预期 ok 或如实报 moved)

```bash
git add packages/meta-cli
git commit -m "feat(meta): links action checks refUrl health"
```

---

### Task 3: asset-intake 契约文档

**Files:**
- Create: `meta/prompts/asset-intake.md`
- Modify: `meta/README.md`(prompts 清单提及 asset-intake)

**Interfaces:** 无代码接口;文档对照 spec「组成二」逐条落地。

- [ ] **Step 1: 写契约**

结构参照 meta/prompts 现有契约风格(中文、姿态化、分节),必须覆盖:

1. **触发**:用户提供官方链接(参考来源)并要求引入资产
2. **抓取纪律**:MUST 真实抓取该链接(WebFetch 等),MUST NOT 凭记忆或训练数据描述页面内容;抓取失败即停,报告后等用户
3. **提取与判类**:列出页面提供/推荐的资产;操作性知识 → skill(按 SKILLS.md 三分法 official/mirror/custom);姿态化约束素材 → rule(建 meta/rules 元指令,stub 起步);mcp/agent → 不建账,输出「发现 <名>,类别 <mcp|agent>,账未立项,refUrl=<链接>」
4. **溯源落账**:每个新资产 MUST 记 `refUrl`(参考来源=用户给的链接或页面内更精确的权威页);实际来源按情况落 `repo/path/commit`(repo 类)或 `install`(命令/目录类,如工具安装目录内自带的 skill);rule 另在正文首段写人读的收编来源
5. **人审**:全部产出(账条目、元指令)提交用户确认后落地;official skill 的安装按 SKILLS.md 现行方式
6. **来源更新(独立步骤)**:`imeta links` 报 broken/moved 后——手动改账,或指派 AI 重新检索定位新权威页(按本契约抓取纪律验证后更新 refUrl);moved 且带新址的优先验证新址

- [ ] **Step 2: 自查 + Commit**

对照 spec 组成二逐条核;meta/README.md 的 prompts 说明加一行。

```bash
git add meta/prompts/asset-intake.md meta/README.md
git commit -m "docs(meta): asset intake contract with two-layer provenance"
```

---

## 收尾

1. `pnpm meta status` 退 0;`pnpm meta links` 真机跑一次记录结果
2. 两包测试/typecheck/lint 全绿,push 后 CI 绿
3. 最终 whole-branch review

## Self-Review 记录

- Spec 覆盖:schema(Task 1)、links(Task 2)、契约(Task 3)、非目标未越界(mcp/agent 只提示、不自动改、不执行 install、不并入 status)
- 类型一致:SkillEntry.refUrl/install 与 MetaAsset.refUrl 在 Task 1 定义、Task 2 消费;LinkRow/classifyLinkStatus Task 2 内自洽
- 已知取舍:302/307 临时重定向算 ok(临时性质不构成「需更新」);catalog 不含 refUrl(spec 明文)
