# 产物 web 预览 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 `docs/superpowers/specs/2026-07-13-preview-web-design.md`，新增 `packages/preview`（web starter 起底 + shadcn/ui）提供元指令|产物对照预览，`imeta preview` / TUI `v` 一键启动并打开。

**Architecture:** meta-cli 开 core barrel 供 preview 复用发现/状态逻辑（单源）；preview 是 Bun.serve 单进程（页面 + `/api/assets`、`/api/asset/:name`，每请求现读文件）；入口经注册表新增 `preview` 动作（探测→按需 detached 启动→open），parity 自动覆盖。

**Tech Stack:** 既有栈 + `packages/preview`（Bun full-stack、React 19、Tailwind v4、shadcn/ui、marked）。

## Global Constraints

- 包管理 pnpm；运行与测试 bun；文件名 kebab-case（shadcn 生成即 kebab）
- 源代码禁止 emoji；禁止 `@ts-ignore`；禁止双重断言；禁止 `!` 非空断言
- commit message 英文，Conventional Commits
- 每任务提交前：meta-cli 与 preview 两包各自 `bun test` + typecheck + lint 全过（preview 的 lint 用 starter 自带配置）
- 端口固定 **4412**；server 日志 `.imeta/preview-server.log`；探测端点 `GET /api/assets`
- 外部效应经注入：`fetchJson`（探测）、`spawnDetached`（启动）、`ctx.run`（open）——meta-cli 测试不起真实 server
- 既有接口：`ActionContext { repoRoot, run, now, claude, download, fetchJson }`、`runAction`、`KEYMAP`、parity 测试（CLI 树 == ACTIONS ids、KEYMAP 覆盖 ACTIONS）

---

### Task 1: meta-cli core barrel 导出

**Files:**
- Create: `packages/meta-cli/src/core/index.ts`
- Modify: `packages/meta-cli/package.json`（exports 字段）
- Test: `packages/meta-cli/tests/core-barrel.test.ts`

**Interfaces:**
- Produces（Task 3 的 preview server 消费）：包导出 `@infra-ai/meta-cli/core`，含
  `loadOverview`、`readTextIfExists`、type `OverviewRow`/`MetaAsset`/`AssetKind`/`ReconcileStatus`

- [ ] **Step 1: 写失败测试**

`packages/meta-cli/tests/core-barrel.test.ts`：

```ts
import { describe, expect, test } from 'bun:test'
import { loadOverview, readTextIfExists } from '../src/core/index'

describe('core barrel', () => {
  test('re-exports the read-side surface preview depends on', () => {
    expect(typeof loadOverview).toBe('function')
    expect(typeof readTextIfExists).toBe('function')
  })
})
```

```bash
cd packages/meta-cli && bun test tests/core-barrel.test.ts   # 期望: FAIL（index 不存在）
```

- [ ] **Step 2: 实现**

`packages/meta-cli/src/core/index.ts`：

```ts
export { loadOverview } from './overview'
export type { OverviewRow } from './overview'
export { discoverAssets } from './meta'
export type { MetaAsset, MetaStatus } from './meta'
export type { AssetKind } from './kinds'
export type { ReconcileStatus } from './status'
export { readTextIfExists } from './io'
```

`packages/meta-cli/package.json` 增加（`"type": "module"` 之后）：

```json
  "exports": {
    "./core": "./src/core/index.ts"
  },
```

- [ ] **Step 3: 验证并提交**

```bash
bun test && pnpm --filter @infra-ai/meta-cli typecheck && pnpm --filter @infra-ai/meta-cli lint
git add packages/meta-cli
git commit -m "feat(meta-cli): expose core read surface for workspace consumers"
```

---

### Task 2: packages/preview 脚手架 + shadcn/ui

**Files:**
- Create: `packages/preview/`（giget 起底后改造）
- Modify: `packages/preview/package.json`、`tsconfig.json`、`server.ts`（仅端口，路由 Task 3 做）

**Interfaces:**
- Produces: 可启动的 preview 包（`pnpm --filter @infra-ai/preview dev` 在 4412 提供页面）；
  shadcn 组件 `src/components/ui/{badge,tabs,scroll-area,separator}.tsx`；
  tsconfig path alias `@/* → ./src/*`

- [ ] **Step 1: 拉取 starter 并清理**

```bash
cd /Users/xiu/code/infra-ai
bunx giget@latest gh:oNo500/infra-code/starters/web#master packages/preview
rm -rf packages/preview/bun.lock packages/preview/.github packages/preview/.nvmrc packages/preview/README.md
```

- [ ] **Step 2: 改造 package.json 与 tsconfig**

`packages/preview/package.json`：`name` 改 `@infra-ai/preview`、`private: true`；
dependencies 增加 `"@infra-ai/meta-cli": "workspace:*"`、`"marked": "^15.0.0"`
（其余 starter 依赖与 scripts 保留）。

`packages/preview/tsconfig.json` 的 `compilerOptions` 增加：

```json
    "paths": { "@/*": ["./src/*"] }
```

`packages/preview/server.ts`：端口改为 4412（starter 默认 3000 处替换）。

```bash
pnpm install
```

- [ ] **Step 3: shadcn init 与组件**

```bash
cd packages/preview
bunx shadcn@latest init --yes
bunx shadcn@latest add badge tabs scroll-area separator --yes
```

若 init 交互阻塞（非 TTY），手写 `packages/preview/components.json` 后重跑 add：

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": { "config": "", "css": "src/styles.css", "baseColor": "neutral", "cssVariables": true },
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui", "lib": "@/lib", "hooks": "@/hooks" },
  "iconLibrary": "lucide"
}
```

（shadcn 会生成 `src/lib/utils.ts` 与依赖 `clsx`/`tailwind-merge` 等——照收；
生成文件名已是 kebab-case。）

- [ ] **Step 4: 启动冒烟并提交**

```bash
cd /Users/xiu/code/infra-ai
(pnpm --filter @infra-ai/preview dev > /tmp/preview-smoke.log 2>&1 &) && sleep 3
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4412/   # 期望 200
pkill -f 'preview.*server.ts' || pkill -f 'bun.*--hot.*server.ts'
pnpm --filter @infra-ai/preview typecheck && pnpm --filter @infra-ai/preview lint && pnpm --filter @infra-ai/preview test
git add packages/preview pnpm-lock.yaml
git commit -m "feat(preview): scaffold web preview package from starter with shadcn"
```

---

### Task 3: API 路由（现读文件）

**Files:**
- Create: `packages/preview/src/api.ts`
- Modify: `packages/preview/server.ts`（接路由）
- Test: `packages/preview/tests/api.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `@infra-ai/meta-cli/core`
- Produces（Task 4 的前端消费，type-only import 进客户端）:

```ts
export interface AssetSummary { name: string; kind: string; status: string }
export interface AssetDetail extends AssetSummary {
  metaPath: string; artifactPath: string; meta: string; artifact: string | null
}
export function assetsPayload(repoRoot: string): AssetSummary[]
export function assetPayload(repoRoot: string, name: string): AssetDetail | null
```

- [ ] **Step 1: 写失败测试**

`packages/preview/tests/api.test.ts`：

```ts
import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assetPayload, assetsPayload } from '../src/api'

function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'preview-'))
  writeFileSync(join(root, 'skills.json'), '[]\n')
  mkdirSync(join(root, 'meta/rules'), { recursive: true })
  writeFileSync(
    join(root, 'meta/rules/foo.md'),
    '---\nname: foo\nstatus: ready\nscope: global\n---\nintent\n',
  )
  mkdirSync(join(root, 'rules/global'), { recursive: true })
  writeFileSync(join(root, 'rules/global/foo.md'), '# foo artifact\n')
  return root
}

describe('preview api payloads', () => {
  test('assetsPayload lists assets with status', () => {
    const root = fixtureRepo()
    try {
      const list = assetsPayload(root)
      expect(list).toHaveLength(1)
      expect(list[0]).toEqual({ name: 'foo', kind: 'rule', status: 'untracked' })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('assetPayload returns both documents; unknown name returns null; missing artifact is null', () => {
    const root = fixtureRepo()
    try {
      const detail = assetPayload(root, 'foo')
      expect(detail?.meta).toContain('intent')
      expect(detail?.artifact).toContain('# foo artifact')
      expect(detail?.metaPath).toBe('meta/rules/foo.md')
      expect(assetPayload(root, 'nope')).toBeNull()
      rmSync(join(root, 'rules/global/foo.md'))
      expect(assetPayload(root, 'foo')?.artifact).toBeNull()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
```

```bash
cd packages/preview && bun test tests/api.test.ts   # 期望: FAIL
```

- [ ] **Step 2: 实现 api.ts**

`packages/preview/src/api.ts`：

```ts
import { join } from 'node:path'
import { loadOverview, readTextIfExists } from '@infra-ai/meta-cli/core'

export interface AssetSummary {
  name: string
  kind: string
  status: string
}

export interface AssetDetail extends AssetSummary {
  metaPath: string
  artifactPath: string
  meta: string
  artifact: string | null
}

export function assetsPayload(repoRoot: string): AssetSummary[] {
  return loadOverview(repoRoot).map((row) => ({
    name: row.asset.name,
    kind: row.asset.kind,
    status: row.status,
  }))
}

export function assetPayload(repoRoot: string, name: string): AssetDetail | null {
  const row = loadOverview(repoRoot).find((r) => r.asset.name === name)
  if (!row) return null
  return {
    name: row.asset.name,
    kind: row.asset.kind,
    status: row.status,
    metaPath: row.asset.metaPath,
    artifactPath: row.asset.artifactPath,
    meta: readTextIfExists(join(repoRoot, row.asset.metaPath)) ?? '',
    artifact: readTextIfExists(join(repoRoot, row.asset.artifactPath)),
  }
}
```

- [ ] **Step 3: server.ts 接路由（全量替换）**

`packages/preview/server.ts`：

```ts
import { join } from 'node:path'
import index from './index.html'
import { assetPayload, assetsPayload } from './src/api'

const REPO_ROOT = join(import.meta.dir, '..', '..')
const PORT = 4412

Bun.serve({
  port: PORT,
  routes: {
    '/*': index,
    '/api/assets': () => Response.json(assetsPayload(REPO_ROOT)),
    '/api/asset/:name': (req) => {
      const payload = assetPayload(REPO_ROOT, req.params.name)
      return payload ? Response.json(payload) : new Response('not found', { status: 404 })
    },
  },
})

console.log(`preview at http://localhost:${PORT}`)
```

（若 starter 的 server.ts 有 HMR/development 配置项，保留合并进来。）

- [ ] **Step 4: 验证并提交**

```bash
bun test && pnpm --filter @infra-ai/preview typecheck && pnpm --filter @infra-ai/preview lint
(pnpm --filter @infra-ai/preview dev > /tmp/preview-smoke.log 2>&1 &) && sleep 3
curl -s http://localhost:4412/api/assets | head -c 300; echo
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4412/api/asset/nope   # 期望 404
pkill -f 'server.ts'
git add packages/preview
git commit -m "feat(preview): serve asset payload api reading repo files per request"
```

---

### Task 4: 前端 UI（列表 + 对照双栏）

**Files:**
- Create: `packages/preview/src/lib/markdown.ts`、`src/components/asset-list.tsx`、`src/components/asset-view.tsx`
- Modify: `packages/preview/src/app.tsx`（全量替换）、`src/styles.css`（追加 .md 排版）
- Test: `packages/preview/tests/markdown.test.ts`

**Interfaces:**
- Consumes: Task 3 的 `AssetSummary`/`AssetDetail`（`import type`，打包时擦除）、shadcn 组件

- [ ] **Step 1: 写失败测试（markdown 工具）**

`packages/preview/tests/markdown.test.ts`：

```ts
import { describe, expect, test } from 'bun:test'
import { parseDoc } from '../src/lib/markdown'

describe('parseDoc', () => {
  test('splits frontmatter and renders body to html', () => {
    const { frontmatter, html } = parseDoc('---\nname: x\n---\n# Title\n\n- item\n')
    expect(frontmatter).toBe('name: x')
    expect(html).toContain('<h1')
    expect(html).toContain('<li>')
  })
  test('no frontmatter yields null and full render', () => {
    const { frontmatter, html } = parseDoc('plain **bold**\n')
    expect(frontmatter).toBeNull()
    expect(html).toContain('<strong>')
  })
})
```

```bash
bun test tests/markdown.test.ts   # 期望: FAIL
```

- [ ] **Step 2: 实现 markdown.ts**

`packages/preview/src/lib/markdown.ts`：

```ts
import { marked } from 'marked'

export interface ParsedDoc {
  frontmatter: string | null
  html: string
}

export function parseDoc(content: string): ParsedDoc {
  const match = /^---\n([\s\S]*?)\n---\n?/u.exec(content)
  const frontmatter = match ? (match[1] ?? null) : null
  const body = match ? content.slice(match[0].length) : content
  return { frontmatter, html: marked.parse(body, { async: false }) }
}
```

- [ ] **Step 3: 组件与 App**

`packages/preview/src/components/asset-list.tsx`：

```tsx
import { Badge } from '@/components/ui/badge'
import type { AssetSummary } from '../api'

const STATUS_CLASS: Record<string, string> = {
  synced: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300',
  stale: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  dirty: 'bg-red-600/15 text-red-700 dark:text-red-300',
  unbuilt: 'bg-cyan-600/15 text-cyan-700 dark:text-cyan-300',
  untracked: 'bg-fuchsia-600/15 text-fuchsia-700 dark:text-fuchsia-300',
  stub: 'bg-muted text-muted-foreground',
}

export function AssetList({
  assets,
  selected,
  onSelect,
}: {
  assets: AssetSummary[]
  selected: string | null
  onSelect: (name: string) => void
}) {
  return (
    <nav className="px-2 pb-4 flex flex-col gap-0.5">
      {assets.map((asset) => (
        <button
          key={asset.name}
          type="button"
          onClick={() => onSelect(asset.name)}
          className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left font-mono text-sm ${
            asset.name === selected ? 'bg-accent' : 'hover:bg-accent/50'
          }`}
        >
          <span className="truncate">{asset.name}</span>
          <span className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{asset.kind}</span>
            <Badge variant="outline" className={STATUS_CLASS[asset.status] ?? ''}>
              {asset.status}
            </Badge>
          </span>
        </button>
      ))}
    </nav>
  )
}
```

`packages/preview/src/components/asset-view.tsx`：

```tsx
import { useEffect, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { parseDoc } from '../lib/markdown'
import type { AssetDetail } from '../api'

function Doc({ path, content, missing }: { path: string; content: string | null; missing: string }) {
  if (content === null) {
    return <div className="p-6 text-sm text-muted-foreground">{missing}</div>
  }
  const { frontmatter, html } = parseDoc(content)
  return (
    <ScrollArea className="h-full">
      <div className="p-6">
        <div className="mb-3 font-mono text-xs text-muted-foreground">{path}</div>
        {frontmatter !== null && (
          <pre className="mb-4 overflow-x-auto rounded bg-muted p-3 font-mono text-xs">{frontmatter}</pre>
        )}
        <article className="md" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </ScrollArea>
  )
}

export function AssetView({ name }: { name: string }) {
  const [detail, setDetail] = useState<AssetDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDetail(null)
    setError(null)
    void fetch(`/api/asset/${encodeURIComponent(name)}`).then(async (res) => {
      if (!res.ok) {
        setError(`加载失败：${res.status}`)
        return
      }
      setDetail((await res.json()) as AssetDetail)
    })
  }, [name])

  if (error !== null) return <div className="p-8 text-sm text-red-600">{error}</div>
  if (detail === null) return <div className="p-8 text-sm text-muted-foreground">加载中…</div>

  const metaDoc = <Doc path={detail.metaPath} content={detail.meta} missing="" />
  const artifactDoc = <Doc path={detail.artifactPath} content={detail.artifact} missing="产物尚未构建" />

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b px-6 py-3">
        <span className="font-mono font-semibold">{detail.name}</span>
        <span className="text-xs text-muted-foreground">
          {detail.kind} · {detail.status}
        </span>
      </header>
      <div className="hidden min-h-0 flex-1 lg:flex">
        <div className="min-w-0 flex-1">{metaDoc}</div>
        <Separator orientation="vertical" />
        <div className="min-w-0 flex-1">{artifactDoc}</div>
      </div>
      <Tabs defaultValue="artifact" className="flex min-h-0 flex-1 flex-col lg:hidden">
        <TabsList className="mx-6 mt-3">
          <TabsTrigger value="meta">元指令</TabsTrigger>
          <TabsTrigger value="artifact">产物</TabsTrigger>
        </TabsList>
        <TabsContent value="meta" className="min-h-0 flex-1">
          {metaDoc}
        </TabsContent>
        <TabsContent value="artifact" className="min-h-0 flex-1">
          {artifactDoc}
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

`packages/preview/src/app.tsx` 全量替换：

```tsx
import { useEffect, useState } from 'react'
import { AssetList } from './components/asset-list'
import { AssetView } from './components/asset-view'
import type { AssetSummary } from './api'

function hashName(): string | null {
  const raw = window.location.hash.replace(/^#/u, '')
  return raw === '' ? null : decodeURIComponent(raw)
}

export function App() {
  const [assets, setAssets] = useState<AssetSummary[]>([])
  const [selected, setSelected] = useState<string | null>(hashName())

  useEffect(() => {
    void fetch('/api/assets').then(async (res) => {
      const list = (await res.json()) as AssetSummary[]
      setAssets(list)
      setSelected((current) => current ?? list[0]?.name ?? null)
    })
  }, [])

  useEffect(() => {
    const onHash = () => setSelected(hashName())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="w-64 shrink-0 overflow-y-auto border-r">
        <div className="px-4 py-3 font-mono text-sm font-semibold">infra-ai preview</div>
        <AssetList
          assets={assets}
          selected={selected}
          onSelect={(name) => {
            window.location.hash = encodeURIComponent(name)
          }}
        />
      </aside>
      <main className="min-w-0 flex-1">
        {selected !== null ? (
          <AssetView name={selected} />
        ) : (
          <div className="p-8 text-sm text-muted-foreground">选择左侧资产</div>
        )}
      </main>
    </div>
  )
}
```

`packages/preview/src/styles.css` 追加（保留既有内容）：

```css
.md h1 { font-size: 1.35rem; font-weight: 700; margin: 1.2rem 0 .6rem; }
.md h2 { font-size: 1.1rem; font-weight: 700; margin: 1.4rem 0 .5rem; padding-top: .8rem; border-top: 1px solid color-mix(in srgb, currentColor 15%, transparent); }
.md p { margin: .5rem 0; line-height: 1.7; max-width: 46em; }
.md ul { margin: .5rem 0; padding-left: 1.4em; list-style: disc; }
.md li { margin: .3rem 0; line-height: 1.65; }
.md code { font-family: ui-monospace, monospace; font-size: .85em; background: color-mix(in srgb, currentColor 10%, transparent); padding: .08em .35em; border-radius: 3px; }
.md pre { overflow-x: auto; background: color-mix(in srgb, currentColor 8%, transparent); padding: .7rem .9rem; border-radius: 4px; }
.md pre code { background: none; padding: 0; }
```

- [ ] **Step 4: 冒烟并提交**

```bash
bun test && pnpm --filter @infra-ai/preview typecheck && pnpm --filter @infra-ai/preview lint
(pnpm --filter @infra-ai/preview dev > /tmp/preview-smoke.log 2>&1 &) && sleep 3
curl -s http://localhost:4412/ | grep -c 'root'   # 期望 >=1（页面壳）
pkill -f 'server.ts'
git add packages/preview
git commit -m "feat(preview): asset list and side-by-side document view"
```

---

### Task 5: imeta preview 动作 + TUI v 键 + 文档

**Files:**
- Modify: `packages/meta-cli/src/core/io.ts`（spawnDetached）
- Modify: `packages/meta-cli/src/core/actions.ts`（ActionContext.spawnDetached、preview 动作）
- Modify: `packages/meta-cli/src/tui/keymap.ts`、`src/tui/app.tsx`（v 键）
- Modify: `.claude/rules/architecture.md`、`.claude/CLAUDE.md`、`README.md`
- Test: `packages/meta-cli/tests/actions.test.ts`（追加）

**Interfaces:**
- Produces:
  - `io.ts`: `spawnDetached(cmd: string, args: string[], opts: { cwd: string; logPath: string }): void`
    （日志 fd append，`detached: true` + `unref`）
  - `ActionContext` 增加 `spawnDetached: typeof spawnDetached`（defaultContext 接 io 实现；
    testContext 加 noop fake）
  - 注册表新增 `preview` 动作（mutation，args: `[name?]`），常量
    `PREVIEW_URL = 'http://localhost:4412'`

- [ ] **Step 1: 追加失败测试**

`packages/meta-cli/tests/actions.test.ts`（`testContext` 默认值补
`spawnDetached: () => {}`）：

```ts
describe('preview action', () => {
  test('opens directly when server already answers', async () => {
    const root = fixtureRepo()
    try {
      const opened: string[][] = []
      const run: ActionContext['run'] = async (cmd, args) => {
        opened.push([cmd, ...args])
        return { code: 0, stdout: '', stderr: '' }
      }
      const spawned: string[] = []
      const result = await getAction('preview').execute(
        testContext(root, {
          run,
          fetchJson: async () => [],
          spawnDetached: (cmd) => {
            spawned.push(cmd)
          },
        }),
        { positionals: ['foo'], flags: {} },
      )
      expect(result.ok).toBe(true)
      expect(spawned).toHaveLength(0)
      expect(opened[0]).toEqual(['open', 'http://localhost:4412/#foo'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('spawns server when probe fails, then opens after it comes up', async () => {
    const root = fixtureRepo()
    try {
      let up = false
      const fetchJson: ActionContext['fetchJson'] = async () => {
        if (!up) throw new Error('down')
        return []
      }
      const spawned: string[][] = []
      const spawnDetached: ActionContext['spawnDetached'] = (cmd, args) => {
        spawned.push([cmd, ...args])
        up = true
      }
      const run: ActionContext['run'] = async () => ({ code: 0, stdout: '', stderr: '' })
      const result = await getAction('preview').execute(
        testContext(root, { fetchJson, spawnDetached, run }),
        { positionals: [], flags: {} },
      )
      expect(result.ok).toBe(true)
      expect(spawned).toHaveLength(1)
      expect(spawned[0]?.[0]).toBe('bun')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('unknown asset name fails before any spawn', async () => {
    const root = fixtureRepo()
    try {
      const spawned: string[] = []
      const result = await getAction('preview').execute(
        testContext(root, {
          spawnDetached: (cmd) => {
            spawned.push(cmd)
          },
        }),
        { positionals: ['nope'], flags: {} },
      )
      expect(result.ok).toBe(false)
      expect(result.message).toMatch(/unknown asset/u)
      expect(spawned).toHaveLength(0)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
```

（不加「永不就绪超时」用例——轮询 20×250ms 会拖慢 5 秒，超时路径由实现
内计数保证，代码审查把关。）

```bash
cd packages/meta-cli && bun test tests/actions.test.ts   # 期望: preview describe FAIL
```

- [ ] **Step 2: 实现**

`packages/meta-cli/src/core/io.ts` 追加：

```ts
import { openSync } from 'node:fs'   // 并入既有 node:fs import

export function spawnDetached(
  cmd: string,
  args: string[],
  opts: { cwd: string; logPath: string },
): void {
  mkdirSync(dirname(opts.logPath), { recursive: true })
  const fd = openSync(opts.logPath, 'a')
  const child = spawn(cmd, args, {
    cwd: opts.cwd,
    detached: true,
    stdio: ['ignore', fd, fd],
  })
  child.unref()
}
```

`packages/meta-cli/src/core/actions.ts`：

- `ActionContext` 增加 `spawnDetached: typeof spawnDetached`；`defaultContext` 接
  `spawnDetached`（import 自 './io'）
- 新增动作（`ACTIONS` 中放在 `writeback` 之后、`skills:status` 之前，
  最终顺序 `status, adopt, build, writeback, preview, skills:*`）：

```ts
const PREVIEW_URL = 'http://localhost:4412'

const previewAction: ActionDef = {
  id: 'preview',
  summary: 'Open the web preview (meta vs artifact side by side), starting the server if needed',
  kind: 'mutation',
  args: [{ name: 'name', kind: 'positional', description: 'asset name (optional)' }],
  async execute(ctx, params, hooks) {
    const name = params.positionals[0]
    if (name !== undefined && findAsset(ctx.repoRoot, name) === null) {
      return fail(`unknown asset: ${name}`)
    }
    const probe = async (): Promise<boolean> => {
      try {
        await ctx.fetchJson(`${PREVIEW_URL}/api/assets`)
        return true
      } catch {
        return false
      }
    }
    if (!(await probe())) {
      hooks?.onText?.('starting preview server...')
      ctx.spawnDetached('bun', ['run', 'dev'], {
        cwd: join(ctx.repoRoot, 'packages/preview'),
        logPath: join(ctx.repoRoot, '.imeta', 'preview-server.log'),
      })
      let ready = false
      for (let i = 0; i < 20 && !ready; i++) {
        await new Promise((resolve) => setTimeout(resolve, 250))
        ready = await probe()
      }
      if (!ready) {
        return fail('preview server failed to start (log: .imeta/preview-server.log)')
      }
    }
    const url = `${PREVIEW_URL}/${name === undefined ? '' : `#${encodeURIComponent(name)}`}`
    const res = await ctx.run('open', [url])
    if (res.code !== 0) return fail(`open failed: ${res.stderr}`)
    return { ok: true, message: `preview at ${url}` }
  },
}
```

`packages/meta-cli/src/tui/keymap.ts` 增加条目：
`{ actionId: 'preview', view: 'assets', key: 'v' },`

`packages/meta-cli/src/tui/app.tsx` 空闲分支（`w` 处理器之后）追加，
底部键位提示在「w 回写」后加 `v 预览`：

```tsx
    if (input === 'v') {
      runJob(`预览 ${row.asset.name}`, (onText) =>
        runAction(ctx, 'preview', { positionals: [row.asset.name], flags: {} }, { onText }).then(
          (r) => {
            if (r.ok && r.message) onText(r.message)
            return r.ok ? null : `${r.message ?? 'failed'}${r.logPath ? `\nlog: ${r.logPath}` : ''}`
          },
        ),
      )
    }
```

- [ ] **Step 3: 文档**

- `.claude/rules/architecture.md`：Project Structure 树 `packages/meta-cli/` 行后加
  `├── packages/preview/          # 产物 web 预览（Bun.serve + React，imeta preview 拉起）`
- `.claude/CLAUDE.md` 命令代码块加一行：
  `imeta preview [name]      # web 预览：元指令与产物对照（自动启动本地 server）`
- `README.md` 命令代码块加同样一行；内容清单加
  `- [\`packages/preview/\`](packages/preview/) — 产物 web 预览（元指令|产物对照，imeta preview / TUI v 拉起，端口 4412）`

- [ ] **Step 4: 全量验证 + 真实冒烟 + 提交**

```bash
cd packages/meta-cli && bun test && cd ../preview && bun test && cd /Users/xiu/code/infra-ai
pnpm --filter @infra-ai/meta-cli typecheck && pnpm --filter @infra-ai/meta-cli lint
pnpm --filter @infra-ai/preview typecheck && pnpm --filter @infra-ai/preview lint
imeta preview typescript; echo "exit=$?"    # 期望: 启动 server、浏览器打开 #typescript、exit 0
curl -s http://localhost:4412/api/assets | head -c 200; echo
git add packages/meta-cli packages/preview README.md
git add -f .claude/CLAUDE.md .claude/rules/architecture.md
git commit -m "feat(meta-cli): add preview action opening the web comparison view"
```

（真实冒烟会留下常驻 preview server 进程——预期行为，报告注明即可。）

---

## Self-Review 记录

- Spec 覆盖：Decision 1（Task 2 脚手架 + shadcn 四件）、2（Task 1 barrel + Task 3 现读 API）、
  3（Task 4 UI：badge 语义色、双栏/tabs、hash 直链、marked）、4（Task 5 动作 + v 键 + parity 自动覆盖 +
  spawnDetached + 日志路径）、5（端口 4412 常量 + 失败指路）；Error Handling
  （404 页面错误态 Task 4、启动超时 fail Task 5）；Non-Goals 未越界（无 websocket/编辑/鉴权/build 流程）。
- 类型一致性：`AssetSummary`/`AssetDetail` 在 Task 3/4 一致；`spawnDetached` 签名在 io/ActionContext/
  测试一致；`PREVIEW_URL` 单处常量。
- 已知取舍：preview 动作的超时路径不写慢测试（5 秒），靠审查把关——已在 Task 5 Step 1 注明；
  真实冒烟遗留常驻 server 进程属预期。
