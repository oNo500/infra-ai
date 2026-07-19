# Meta Dev-Repo Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 资产管理迁出 infra-ai：新建 `~/code/meta` 开发仓（元指令 + 工具链 + 账 + 产物工作副本），新增 `imeta publish` 把验证过的产物与账落位到 infra-ai 发布面。

**Architecture:** 两仓模型——meta 仓建/构/验闭环，infra-ai 只接收 publish 落位（不代提交，人审 git diff）。publish 进动作注册表（CLI 子命令自动生成，keymap 手动加键位，parity 测试把关）。spec 见 `docs/superpowers/specs/2026-07-19-meta-dev-repo-split-design.md`。

**Tech Stack:** bun + TypeScript workspace（meta-cli/iuse/preview），bun test，citty，pnpm link --global。

## Global Constraints

- 源代码禁 emoji；文件与目录 kebab-case；文档禁表格、正文中文为主
- Commit message 英文 Conventional Commits，结尾 `Claude-Session: https://claude.ai/code/session_014qFwy6t5VhLF85toupsepd`
- 测试只写关键用例（项目 CLAUDE.md 指示：减少无意义的测试用例）
- 新增动作必须先进 `packages/meta-cli/src/core/actions.ts` 注册表再接 keymap；`tests/parity.test.ts` 不过不得提交
- mutation 动作自动留 run log，无需手写
- 编辑期间忽略实时 LSP 诊断，批量改完 `pnpm typecheck` 为准

## 对 spec 的一处修正

spec 写「发布前重建 catalog」。实现改为**发布前校验 catalog 不 stale**（`catalogStaleness === null`，否则拒发并提示 `imeta catalog`），然后照搬既有 catalog.json——重建会刷新 `generatedAt` 时间戳，制造无意义 diff，破坏「首次发布零 diff」的闭环验证。

---

### Task 1: 新仓 ~/code/meta 落成（copy + install + link + 全绿）

**Files:**
- Create: `/Users/xiu/code/meta/`（新 git 仓）
- 不改 infra-ai 任何文件

**Interfaces:**
- Consumes: infra-ai 现仓内容（copy 源）
- Produces: 可工作的开发仓——`imeta status` 退 0、三包测试全绿、全局 `imeta`/`iuse` 由新仓提供

- [ ] **Step 1: 建仓并拷贝**

```bash
mkdir -p /Users/xiu/code/meta && cd /Users/xiu/code/meta && git init
cd /Users/xiu/code/infra-ai
cp -R meta rules skills templates packages /Users/xiu/code/meta/
cp skills.json profiles.json globals.json catalog.json artifacts.lock.json \
   SKILLS.md package.json pnpm-workspace.yaml pnpm-lock.yaml .gitignore /Users/xiu/code/meta/
cp -R .claude /Users/xiu/code/meta/
rm -rf /Users/xiu/code/meta/packages/*/node_modules
```

- [ ] **Step 2: 调整新仓 .claude/CLAUDE.md 开头**

把首段仓库定位改为（其余章节保留）：

```markdown
**meta** — 资产开发仓：skill、rule、模板的元指令、构建与验证在此闭环。
验证过的产物用 `imeta publish` 落位到发布仓 infra-ai（缺省 ~/code/infra-ai），
人审 diff 后提交。下游只从 infra-ai 安装。
```

`.claude/rules/architecture.md` 分发节末尾追加一行：

```markdown
- 发布：`imeta publish [name...]` 把产物与账落位发布仓，不代提交
```

- [ ] **Step 3: 安装与全局 link**

```bash
cd /Users/xiu/code/meta && pnpm install
cd packages/meta-cli && pnpm link --global
cd ../iuse && pnpm link --global
```

- [ ] **Step 4: 验证**

```bash
cd /Users/xiu/code/meta && imeta status; echo "exit=$?"
cd packages/meta-cli && bun test 2>&1 | tail -3
cd ../iuse && bun test 2>&1 | tail -3
cd ../preview && bun test 2>&1 | tail -3
which imeta iuse
```

Expected: status 31 资产全 synced 退 0；三包 0 fail；imeta/iuse 指向全局 link。

- [ ] **Step 5: 首 commit**

```bash
cd /Users/xiu/code/meta && git add -A && git commit -m "feat: bootstrap meta dev repo from infra-ai

Asset development moves here: meta instructions, toolchain packages,
ledgers, build lock and artifact working copies. infra-ai becomes the
distribution surface, receiving verified artifacts via imeta publish.

Claude-Session: https://claude.ai/code/session_014qFwy6t5VhLF85toupsepd"
```

---

### Task 2: imeta publish 动作（TDD，在新仓开发）

**Files:**
- Modify: `/Users/xiu/code/meta/packages/meta-cli/src/core/actions.ts`（新增 publishAction，进 ACTIONS）
- Modify: `/Users/xiu/code/meta/packages/meta-cli/src/tui/keymap.ts`（加 `{ actionId: 'publish', view: 'assets', key: 'p' }`）
- Test: `/Users/xiu/code/meta/packages/meta-cli/tests/actions.test.ts`

**Interfaces:**
- Consumes: `discoverAssets`、`gatherFacts`/`computeStatus`/`lockKey`（core/status）、`catalogStaleness`（core/catalog）、`loadLock`
- Produces: 注册表动作 `publish`，args：variadic positional `name`、option `target`；CLI 子命令 `imeta publish` 由注册表自动生成

- [ ] **Step 1: 写关键测试（先红）**

在 actions.test.ts 新增 describe（沿用文件内既有 fixture 惯用法：临时仓 + meta/rules 元指令 + rules/ 产物 + adopt 后 synced；fake run 返回 git status 输出）。只写关键用例：

```ts
describe('publish', () => {
  test('copies synced artifacts and ledgers into target, reports target git status', async () => {
    // fixture: 源仓 foo(rule) synced + skills.json/profiles.json/globals.json/catalog.json 齐备
    // target: 另一临时目录，含 profiles.json
    // run: seqRunner 对 target 的 git status --porcelain 返回 ' M rules/foo.md\n'
    // 断言: target/rules/foo.md 内容与源一致；四账文件已落位；
    //       result.ok true 且 message 含 ' M rules/foo.md'
  })
  test('refuses when a named asset is not synced', async () => {
    // fixture: foo 产物被改（dirty）
    // 断言: ok false，message 点名 foo 与其状态
  })
  test('refuses when target is not an infra-ai shaped repo', async () => {
    // target 无 profiles.json -> ok false
  })
  test('refuses when catalog is stale', async () => {
    // 源仓 catalog.json 与 meta 派生不一致 -> ok false，message 提示 imeta catalog
  })
})
```

Run: `cd /Users/xiu/code/meta/packages/meta-cli && bun test tests/actions.test.ts`
Expected: FAIL（unknown action: publish）

- [ ] **Step 2: 实现 publishAction**

actions.ts 增加（在 linksAction 之后；import 补 `homedir` from 'node:os'、`cpSync, existsSync` from 'node:fs'、`catalogStaleness` 已在 import 内）：

```ts
const PUBLISH_LEDGERS = ['catalog.json', 'profiles.json', 'globals.json', 'skills.json'] as const

const publishAction: ActionDef = {
  id: 'publish',
  summary: 'Copy verified artifacts and ledgers into the distribution repo (default ~/code/infra-ai)',
  kind: 'mutation',
  args: [
    { name: 'name', kind: 'positional', variadic: true, description: 'asset names (default: all ready assets)' },
    { name: 'target', kind: 'option', description: 'distribution repo path (env IMETA_PUBLISH_TARGET, default ~/code/infra-ai)' },
  ],
  async execute(ctx, params, hooks) {
    const target =
      params.options?.target ?? process.env.IMETA_PUBLISH_TARGET ?? join(homedir(), 'code/infra-ai')
    if (!existsSync(join(target, 'profiles.json'))) {
      return fail(`publish target '${target}' is not an infra-ai shaped repo (profiles.json missing)`)
    }
    const staleness = catalogStaleness(ctx.repoRoot)
    if (staleness !== null) return fail(staleness)

    const assets = discoverAssets(ctx.repoRoot)
    let selected: MetaAsset[]
    if (params.positionals.length > 0) {
      const byName = new Map(assets.map((a) => [a.name, a]))
      const unknown = params.positionals.filter((n) => !byName.has(n))
      if (unknown.length > 0) return fail(`unknown assets: ${unknown.join(', ')}`)
      selected = params.positionals.map((n) => byName.get(n) as MetaAsset)
    } else {
      selected = assets.filter((a) => a.status === 'ready')
    }

    const lock = loadLock(ctx.repoRoot)
    const notSynced = selected
      .map((a) => ({ a, status: computeStatus(gatherFacts(ctx.repoRoot, a, lock)) }))
      .filter((e) => e.status !== 'synced')
    if (notSynced.length > 0) {
      return fail(
        `refusing to publish, not synced: ${notSynced.map((e) => `${e.a.name} (${e.status})`).join(', ')}`,
      )
    }

    for (const asset of selected) {
      // skill 产物是目录（skills/<name>/**），rule/template 是单文件
      const rel = asset.kind === 'skill' ? join('skills', asset.name) : asset.artifactPath
      cpSync(join(ctx.repoRoot, rel), join(target, rel), { recursive: true })
      hooks?.onStep?.('copy', { path: rel })
    }
    for (const ledger of PUBLISH_LEDGERS) {
      cpSync(join(ctx.repoRoot, ledger), join(target, ledger))
      hooks?.onStep?.('copy', { path: ledger })
    }

    const porcelain = await ctx.run('git', ['status', '--porcelain'], { cwd: target })
    const changes = porcelain.code === 0 ? porcelain.stdout.trim() : `(git status failed: ${porcelain.stderr.trim()})`
    const summary = changes === '' ? 'target clean: published content identical' : changes
    return {
      ok: true,
      message: `published ${selected.length} assets + ${PUBLISH_LEDGERS.length} ledgers to ${target}\n${summary}\nreview and commit in the target repo`,
    }
  },
}
```

ACTIONS 数组加入 `publishAction`（linksAction 之后）。

- [ ] **Step 3: keymap 加键位**

```ts
{ actionId: 'publish', view: 'assets', key: 'p' },
```

- [ ] **Step 4: 测试与 parity 全绿**

Run: `cd /Users/xiu/code/meta/packages/meta-cli && bun test && pnpm typecheck && pnpm lint`
Expected: PASS（parity 三条断言含 publish；CLI 子命令自动生成）

- [ ] **Step 5: Commit（新仓）**

```bash
cd /Users/xiu/code/meta && git add packages/meta-cli && git commit -m "feat(meta): add publish action copying verified assets to distribution repo

Claude-Session: https://claude.ai/code/session_014qFwy6t5VhLF85toupsepd"
```

---

### Task 3: 首次发布闭环验证 + 文档收尾

**Files:**
- 运行验证为主；Modify: `/Users/xiu/code/meta/.claude/CLAUDE.md` 命令块补 publish 一行（若 Task 1 未涵盖）

**Interfaces:**
- Consumes: Task 1 的新仓 + Task 2 的 publish
- Produces: 端到端验证过的发布通路；infra-ai 零 diff 背书

- [ ] **Step 1: 干净前提确认**

```bash
cd /Users/xiu/code/infra-ai && git status --porcelain
```

记录既有未提交项（.claude/CLAUDE.md 用户改动、.vscode/ 等），发布后对比时排除。

- [ ] **Step 2: 首次 publish**

```bash
cd /Users/xiu/code/meta && imeta publish
```

Expected: `published 31 assets + 4 ledgers`，git status 摘要中**没有**任何 rules/、skills/、templates/、四账文件的新增行（两仓此刻内容一致，落位为同字节覆盖）。若出现 diff，逐文件 `git diff` 查因——多半是 copy 遗漏或时间戳类噪音，修复后重跑。

- [ ] **Step 3: 单资产模式抽查**

```bash
cd /Users/xiu/code/meta && imeta publish markdown && imeta publish nonexistent; echo "exit=$?"
```

Expected: 前者成功且 infra-ai 无新 diff；后者报 unknown assets 退 1。

- [ ] **Step 4: 新仓 CLAUDE.md 命令块确认含 publish**

`imeta publish [name...]  # 发布产物与账到 infra-ai（人审后提交）` 一行存在于命令块，缺则补。

- [ ] **Step 5: Commit（新仓，如有改动）**

```bash
cd /Users/xiu/code/meta && git add -A && git commit -m "docs: publish command in repo guide" || true
```

## Self-Review 记录

- spec 覆盖：两仓落成（Task 1）、publish 机制含全部前置校验（Task 2）、零 diff 闭环（Task 3）、旧仓不动（无任务改 infra-ai，除 publish 落位本身）
- spec 修正一处：重建 catalog 改为校验不 stale（见开头说明），避免 generatedAt 噪音
- 已知不做：旧仓 meta/packages/lock 清理、publish 删除语义（资产在 meta 移除不会同步删除 infra-ai 副本，人工处理）、远端推送
