# Rule Scope Render-at-iuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** scope 从构建期物化改为安装期渲染——rule 产物变为纯正文（无 frontmatter），`rules/global|scoped` 目录拍平为 `rules/`，`paths` frontmatter 由 iuse 在拼装时按 meta `scope` 渲染。

**Architecture:** meta frontmatter 的 `scope` 仍是 SSoT，但降级为与 tags/description 同级的管理元数据（不进构建 hash、改动零重建）。iuse 的 `assembleRules` 是全部对账路径（init/status/update/diff/--global）的汇聚点，渲染只需加在这一处；list/show 直接读 catalog `path` 的两条旁路单独接渲染。渲染字节格式与现有 scoped 产物逐字节一致，下游已装项目迁移后保持 synced。

**Tech Stack:** bun + TypeScript（workspace：packages/meta-cli、packages/iuse、packages/preview），测试 bun test，gray-matter 解析 frontmatter。

## Global Constraints

- 源代码禁 emoji；文件与目录 kebab-case
- Commit message 英文，Conventional Commits，结尾加 `Claude-Session: https://claude.ai/code/session_014qFwy6t5VhLF85toupsepd`
- 文档禁表格（用列表）、正文以中文为主、术语/命令/代码保留英文
- `meta/prompts/*.md` 不得出现流程短语：`上账`、`imeta `、`TUI`、`make `、`对 Claude 说`（tests/prompts.test.ts 红线）
- 每包验证命令：`bun test --timeout 30000`、`pnpm typecheck`（tsc --noEmit）、`pnpm lint`（oxlint）
- 渲染字节格式是硬约束：`---\npaths:\n  - "<glob>"\n---\n\n<正文>`（glob 双引号包裹），与迁移前 scoped 产物逐字节一致，否则下游全部误报 outdated
- 编辑期间不理会实时 LSP 诊断，批量改完跑 `pnpm typecheck` 为准

## 设计裁决记录（本计划的 why）

- scope 的 SSoT 在 meta frontmatter 不变；变的是物化时机——构建期烤进产物改为安装期渲染
- 收益：scope 与 tags/description/requires 待遇统一（改 scope 零重建）；`rules/global|scoped` 冗余目录二分消失；每项目 glob 覆盖有了天然落点（本计划不实现覆盖，MVP）
- 代价：iuse 对账从字节比对变 render-aware——由 assembleRules 单点渲染吸收；`rules/` 下文件不再是安装最终形态，人工 cp 路径退役，新增 `iuse cat <name>` 输出渲染后最终形态补位（--global 建议命令依赖它）

---

### Task 1: meta-cli 拍平 rule 产物路径并禁产物 frontmatter

**Files:**
- Modify: `packages/meta-cli/src/core/kinds.ts:28-55`（rule 的 artifactPath 与 verifyArtifact）
- Modify: `packages/meta-cli/src/core/catalog.ts:11`（注释示例路径）
- Test: `packages/meta-cli/tests/kinds.test.ts`、`packages/meta-cli/tests/meta.test.ts`，以及全部含 `rules/global|scoped` 夹具路径的 meta-cli 测试

**Interfaces:**
- Consumes: 无（首任务）
- Produces: `KINDS.rule.artifactPath(name, scope)` 恒返回 `rules/<name>.md`（scope 参数保留签名但不再影响结果）；`KINDS.rule.verifyArtifact` 对任何带 `paths` frontmatter 的 rule 产物返回违规

- [ ] **Step 1: 改 kinds.test.ts 中 rule 路径与 verifyArtifact 断言（先写失败测试）**

`packages/meta-cli/tests/kinds.test.ts` 中三条 artifactPath 断言改为：

```ts
expect(KINDS.rule.artifactPath('constitution', 'global')).toBe('rules/constitution.md')
expect(KINDS.rule.artifactPath('api', 'src/api/**')).toBe('rules/api.md')
expect(KINDS.rule.artifactPath('python', null)).toBe('rules/python.md')
```

verifyArtifact 相关测试整体替换为（沿用文件里已有的 tmp-root 构造方式，产物路径改 `rules/<name>.md`）：

```ts
test('rule artifact with paths frontmatter is a violation regardless of scope', () => {
  const root = mkdtempSync(join(tmpdir(), 'kinds-'))
  mkdirSync(join(root, 'rules'), { recursive: true })
  writeFileSync(join(root, 'rules/api.md'), '---\npaths:\n  - "src/api/**"\n---\n\n# api\n')
  const asset = { name: 'api', artifactPath: 'rules/api.md', scope: 'src/api/**' }
  expect(KINDS.rule.verifyArtifact(root, asset)).toContain('must not carry paths frontmatter')
})

test('rule artifact without frontmatter passes for any scope', () => {
  const root = mkdtempSync(join(tmpdir(), 'kinds-'))
  mkdirSync(join(root, 'rules'), { recursive: true })
  writeFileSync(join(root, 'rules/api.md'), '# api\n')
  expect(KINDS.rule.verifyArtifact(root, { name: 'api', artifactPath: 'rules/api.md', scope: 'src/api/**' })).toBeNull()
  expect(KINDS.rule.verifyArtifact(root, { name: 'api', artifactPath: 'rules/api.md', scope: 'global' })).toBeNull()
})
```

`packages/meta-cli/tests/meta.test.ts` 的 artifactPathFor 三条断言同步改为 `rules/constitution.md`、`rules/api.md`、`rules/python.md`。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/meta-cli && bun test tests/kinds.test.ts tests/meta.test.ts`
Expected: FAIL（期望 `rules/constitution.md` 实得 `rules/global/constitution.md` 等）

- [ ] **Step 3: 改 kinds.ts**

`packages/meta-cli/src/core/kinds.ts` rule 条目替换为：

```ts
rule: {
  metaDir: 'meta/rules',
  artifactPath: (name) => `rules/${name}.md`,
  buildPrompt: 'meta/prompts/rule-build.md',
  writebackPrompt: 'meta/prompts/rule-writeback.md',
  writableGlob: () => 'rules/**',
  extraAllowedTools: [],
  verifyArtifact: (repoRoot, asset) => {
    const content = readTextIfExists(join(repoRoot, asset.artifactPath))
    if (content === null) return null // 存在性由通用校验负责
    let data: Record<string, unknown>
    try {
      data = matter(content).data as Record<string, unknown>
    } catch (error) {
      return `rule frontmatter unparseable: ${String(error)}`
    }
    if (data.paths !== undefined) {
      return 'rule artifact must not carry paths frontmatter (scope renders at assembly time)'
    }
    return null
  },
},
```

`packages/meta-cli/src/core/catalog.ts:11` 注释改为：

```ts
path: string // 产物相对路径，如 rules/constitution.md
```

- [ ] **Step 4: 批量替换 meta-cli 其余测试夹具路径**

```bash
cd /Users/xiu/code/infra-ai/packages/meta-cli/tests
sed -i '' -e "s|rules/global/|rules/|g" -e "s|rules/scoped/|rules/|g" \
  -e "s|'rules/global'|'rules'|g" -e "s|'rules/scoped'|'rules'|g" \
  actions.test.ts catalog.test.ts claude.test.ts cli.test.ts composition.test.ts overview.test.ts status.test.ts kinds.test.ts
```

替换后通读 `git diff tests/`，确认只有路径串变化、无误伤。

- [ ] **Step 5: 全包测试与类型检查**

Run: `cd packages/meta-cli && bun test && pnpm typecheck`
Expected: PASS（parity/registry 等无关测试不受影响）

- [ ] **Step 6: Commit**

```bash
git add packages/meta-cli
git commit -m "refactor(meta): flatten rule artifact path, forbid paths frontmatter in artifacts"
```

---

### Task 2: metaContentHash 去掉 scope（scope 降级为纯管理元数据）

**Files:**
- Modify: `packages/meta-cli/src/core/meta.ts:58-66`（metaContentHash）
- Test: `packages/meta-cli/tests/meta.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `metaContentHash(content)` 的 kept 字段仅 `{name, status}`——改 scope 不再触发 stale/重建

- [ ] **Step 1: 写失败测试**

`packages/meta-cli/tests/meta.test.ts` 增加：

```ts
test('metaContentHash ignores scope changes (management metadata)', () => {
  const a = metaContentHash('---\nname: x\nstatus: ready\nscope: global\n---\nbody')
  const b = metaContentHash('---\nname: x\nstatus: ready\nscope: "**/*.md"\n---\nbody')
  expect(a).toBe(b)
})
```

若文件中已有「scope 参与 hash」的旧断言，删除之。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/meta-cli && bun test tests/meta.test.ts`
Expected: FAIL（a !== b）

- [ ] **Step 3: 改 meta.ts**

`metaContentHash` 的 kept 改为：

```ts
const kept = {
  name: typeof data.name === 'string' ? data.name : null,
  status: data.status === 'ready' ? 'ready' : 'stub',
}
```

- [ ] **Step 4: 全包测试**

Run: `cd packages/meta-cli && bun test && pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/meta-cli
git commit -m "refactor(meta): drop scope from meta content hash"
```

---

### Task 3: iuse 渲染函数 renderRule 并接入 assembleRules

**Files:**
- Create: `packages/iuse/src/core/render.ts`
- Modify: `packages/iuse/src/core/assemble.ts:29-37`
- Test: `packages/iuse/tests/render.test.ts`（新建）、`packages/iuse/tests/assemble.test.ts`

**Interfaces:**
- Consumes: `MetaAsset.scope`（discoverAssets 已返回）
- Produces: `renderRule(scope: string | null, content: string): string`；`AssemblyItem.content/hash` 均基于渲染后内容——init/status/update/diff/--global 五条路径经 assembleRules 自动继承

- [ ] **Step 1: 写 render.test.ts（失败测试）**

```ts
import { describe, expect, test } from 'bun:test'
import { renderRule } from '../src/core/render'

describe('renderRule', () => {
  test('global scope is identity', () => {
    expect(renderRule('global', '# Constitution\n')).toBe('# Constitution\n')
  })
  test('null scope is identity', () => {
    expect(renderRule(null, '# X\n')).toBe('# X\n')
  })
  test('glob scope prepends paths frontmatter with exact byte format', () => {
    expect(renderRule('**/*.css', '# CSS\n')).toBe('---\npaths:\n  - "**/*.css"\n---\n\n# CSS\n')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd packages/iuse && bun test tests/render.test.ts`
Expected: FAIL（module not found）

- [ ] **Step 3: 写 render.ts**

```ts
/**
 * 把 rule 产物渲染成安装形态。scope 是管理元数据（meta frontmatter / catalog），
 * 不在产物内：scoped 规则在拼装时于此获得 paths frontmatter，global 规则原样落地。
 * 字节格式必须保持稳定——下游 lock 对渲染后内容取 hash。
 */
export function renderRule(scope: string | null, content: string): string {
  if (scope === null || scope === 'global') return content
  return `---\npaths:\n  - "${scope}"\n---\n\n${content}`
}
```

Run: `bun test tests/render.test.ts` -> PASS

- [ ] **Step 4: 改 assemble.test.ts 夹具与断言（失败测试）**

`fixtureSource()` 中产物改为拍平后的纯正文形态：

```ts
mkdirSync(join(dir, 'rules'), { recursive: true })
writeFileSync(join(dir, 'rules', 'constitution.md'), '# Constitution\n')
writeFileSync(join(dir, 'rules', 'markdown.md'), '# Markdown\n')
```

（删除原 `rules/global`、`rules/scoped` 两行 mkdir 与旧产物写入。）

`planAssembly` describe 内追加：

```ts
test('scoped rule content is rendered with paths frontmatter', () => {
  const src = fixtureSource()
  const { items } = planAssembly(src, 'demo')
  const markdown = items.find((i) => i.rule === 'markdown')
  expect(markdown?.content).toBe('---\npaths:\n  - "**/*.md"\n---\n\n# Markdown\n')
  const constitution = items.find((i) => i.rule === 'constitution')
  expect(constitution?.content).toBe('# Constitution\n')
})
```

Run: `bun test tests/assemble.test.ts`
Expected: FAIL（产物缺失 violation 或 content 不含 frontmatter）

- [ ] **Step 5: 改 assemble.ts**

```ts
import { renderRule } from './render'
```

循环体 items.push 前渲染：

```ts
const rendered = renderRule(asset.scope, content)
items.push({ rule, sourcePath, targetRelPath: ruleTargetRelPath(rule), content: rendered, hash: sha256(rendered) })
```

- [ ] **Step 6: 全包测试修复夹具**

Run: `cd packages/iuse && bun test`
init/update/diff/global/tui 等测试夹具若在 `rules/global|scoped` 下造产物，统一改为 `rules/` 平铺 + 纯正文（同 Step 4 模式）；catalog 夹具中 `path` 字段改 `rules/<name>.md`：

```bash
cd /Users/xiu/code/infra-ai/packages/iuse/tests
sed -i '' -e "s|rules/global/|rules/|g" -e "s|rules/scoped/|rules/|g" \
  -e "s|'rules/global'|'rules'|g" -e "s|'rules/scoped'|'rules'|g" *.test.ts *.test.tsx
```

替换后通读 `git diff`，凡夹具产物自带 `paths` frontmatter 的（如旧 scoped 写法），改为纯正文并按需更新对内容/hash 的断言。
Expected: PASS

- [ ] **Step 7: 类型检查与 Commit**

```bash
cd packages/iuse && pnpm typecheck
git add packages/iuse
git commit -m "feat(iuse): render paths frontmatter at assembly time"
```

---

### Task 4: list/show 接渲染、新增 iuse cat、--global 建议命令改用 cat

**Files:**
- Modify: `packages/iuse/src/core/list.ts:80`（buildFilteredRows 读源后渲染）
- Modify: `packages/iuse/src/core/show.ts`（content 渲染 + 新增 catReport）
- Modify: `packages/iuse/src/core/global.ts:87,99-101`（cp 建议改 iuse cat）
- Modify: `packages/iuse/src/cli/index.ts`（新增 cat 子命令并挂到 subCommands）
- Test: `packages/iuse/tests/list.test.ts`、`packages/iuse/tests/show.test.ts`、`packages/iuse/tests/global.test.ts`、`packages/iuse/tests/cli.test.ts`

**Interfaces:**
- Consumes: `renderRule`（Task 3）、catalog `rule.scope`
- Produces: `catReport(ctx, {source?, name}): Promise<{ok: boolean; message?: string; content?: string; exitCode: number}>`（content 为渲染后最终形态）；CLI `iuse cat <name> [--source] [--json]`；global 建议命令格式 `iuse cat <rule> > <home>/.claude/rules/<rule>.md`

- [ ] **Step 1: 写失败测试**

`show.test.ts`：给既有夹具中某 scoped 规则（catalog `scope: "**/*.md"`，产物纯正文）加断言：

```ts
expect(result.content).toBe('---\npaths:\n  - "**/*.md"\n---\n\n# Markdown\n')
```

并新增 catReport 用例：

```ts
test('catReport returns rendered content only', async () => {
  const result = await catReport(ctx, { source: src, name: 'markdown' })
  expect(result.ok).toBe(true)
  expect(result.content).toBe('---\npaths:\n  - "**/*.md"\n---\n\n# Markdown\n')
})

test('catReport unknown rule exits 1', async () => {
  const result = await catReport(ctx, { source: src, name: 'nope' })
  expect(result.ok).toBe(false)
  expect(result.exitCode).toBe(1)
})
```

`global.test.ts`：suggestion 断言改为 `iuse cat <rule> > <path>` 形态。
`list.test.ts`：安装态比对走渲染内容——scoped 规则本地装有渲染后副本时 state 应为 synced 的用例。

Run: `cd packages/iuse && bun test tests/show.test.ts tests/global.test.ts tests/list.test.ts`
Expected: FAIL

- [ ] **Step 2: 改 list.ts**

`buildFilteredRows` 循环内读源两行改为：

```ts
const raw = readTextIfExists(join(sourceRoot, rule.path))
const sourceContent = raw === null ? null : renderRule(rule.scope, raw)
```

（import renderRule；grep 匹配与 state 计算沿用 sourceContent，自动基于渲染后内容。）

- [ ] **Step 3: 改 show.ts**

读产物后渲染：

```ts
const raw = readTextIfExists(join(source.root, rule.path))
const content = raw === null ? null : renderRule(rule.scope, raw)
```

文件末尾新增：

```ts
export async function catReport(
  ctx: IuseContext,
  opts: { source?: string; name: string },
): Promise<{ ok: boolean; message?: string; content?: string; exitCode: number }> {
  const result = await showReport(ctx, { source: opts.source, target: process.cwd(), name: opts.name })
  if (!result.ok || result.content === undefined) {
    return { ok: false, message: result.message ?? `rule '${opts.name}' has no built artifact`, exitCode: 1 }
  }
  return { ok: true, content: result.content, exitCode: 0 }
}
```

- [ ] **Step 4: 改 global.ts 建议命令**

`missing` 分支：

```ts
suggestion: item === undefined ? undefined : `iuse cat ${rule} > ${globalRulePath(ctx.home, rule)}`,
```

`differs` 分支：

```ts
suggestion:
  item === undefined
    ? `iuse diff --global --rule ${rule} 查看差异`
    : `iuse diff --global --rule ${rule} 查看差异; 采纳源版本: iuse cat ${rule} > ${globalRulePath(ctx.home, rule)}`,
```

- [ ] **Step 5: CLI 增加 cat 子命令**

`packages/iuse/src/cli/index.ts`（showCommand 之后）：

```ts
const catCommand = defineCommand({
  meta: {
    name: 'cat',
    description: '输出单条 rule 渲染后的安装形态（纯内容到 stdout，可重定向落盘）。名不存在退 1。',
  },
  args: {
    source: { type: 'string', description: '中心源（本地路径或 gh: 定位符；缺省 INFRA_AI_ROOT 或 ~/code/infra-ai）' },
    json: { type: 'boolean', description: '以单行 JSON 输出到 stdout（机器可读）' },
    name: { type: 'positional', required: true, description: 'rule 名（见 iuse list）' },
  },
  async run({ args }) {
    const result = await catReport(defaultContext(), { source: args.source, name: args.name })
    if (args.json === true) {
      console.log(renderJson({ ok: result.ok, message: result.message, content: result.content }))
    } else if (result.ok && result.content !== undefined) {
      process.stdout.write(result.content)
    } else if (result.message !== undefined) {
      console.error(result.message)
    }
    process.exitCode = result.exitCode
  },
})
```

`buildMainCommand` 的 subCommands 加 `cat: catCommand`，主命令 description 的典型流程句补 `cat`（`list/show/cat 查阅`）。cli.test.ts 若断言子命令清单，同步补 cat。

- [ ] **Step 6: 全包测试、类型检查、Commit**

Run: `cd packages/iuse && bun test && pnpm typecheck && pnpm lint`
Expected: PASS

```bash
git add packages/iuse
git commit -m "feat(iuse): add cat command, render-aware list/show, cat-based global suggestions"
```

---

### Task 5: 改写构建/回写契约与文档

**Files:**
- Modify: `meta/prompts/rule-build.md`
- Modify: `meta/prompts/rule-writeback.md`
- Modify: `meta/README.md`
- Modify: `.claude/rules/architecture.md`
- Modify: `README.md:18`
- Test: `packages/meta-cli/tests/prompts.test.ts`（既有红线，改后必须仍过）

**Interfaces:**
- Consumes: Task 1-4 确立的新语义
- Produces: 契约与文档与代码一致；prompts 不含流程短语

- [ ] **Step 1: rule-build.md**

步骤 2 改为「过下方检查清单，确认该不该独立成文」。步骤 3 整条替换为：

```markdown
3. 产物一律落 `rules/<name>.md`，只有正文——不写任何 frontmatter。
   元指令的 `scope` 是管理元数据，安装时由使用端渲染成产物副本的 `paths`
   frontmatter（`global` 无条件加载，`"<glob>"` 按 glob 触发）；构建时只用
   它判断写法侧重（见「scope 差异」），不落入产物
```

删除整节「### 要不要加 `paths` frontmatter」。「### 落点差异」改名并替换为：

```markdown
### scope 差异

- `scope: global` 的产物安装后无条件进上下文：必须精简、姿态化，
  每主题一文件，每个字都占上下文预算
- `scope: "<glob>"` 的产物按 glob 触发加载：允许更细更长
```

- [ ] **Step 2: rule-writeback.md**

frontmatter 例外条目替换为：

```markdown
- 元指令 frontmatter 一律不动；产物不含 frontmatter，scope/tags 等管理
  元数据的变更不属于回写范围
```

- [ ] **Step 3: meta/README.md**

frontmatter 示例中 scope 行注释改为：

```yaml
scope: global | "<glob>"        # 仅 rule；管理元数据，安装时渲染 paths
```

正文「`scope: global` — 产物落 `rules/global/` …」整条替换为：

```markdown
- `scope` 决定安装后的加载方式：`global` 无条件加载；`"<glob>"` 由使用端在
  安装时渲染成产物副本的 `paths` frontmatter，按 glob 触发加载。产物本身
  一律落 `rules/<name>.md`，不含 frontmatter
```

「tags/requires/description 都是管理元数据」句改为「tags/requires/description/scope 都是管理元数据，不参与构建 hash——补 tag、改描述或改 scope 都不会触发重建」。

- [ ] **Step 4: .claude/rules/architecture.md 与 README.md**

architecture.md 结构树中：

```
├── rules/                     # 可分发 rule 产物（纯正文无 frontmatter；scope 在 meta，安装时渲染）
```

（删除 global/、scoped/ 两行子项。）「分发」节第一条改为：

```markdown
- `rules/` — 产物为纯正文；iuse 安装时按 meta `scope` 渲染 `paths`
  frontmatter 后落地（global 原样 copy）；人工取安装形态用 `iuse cat <name>`
```

README.md 第 18 行改为：

```markdown
- [`rules/`](rules/) — 可分发 rule 的构建产物：纯正文不含 frontmatter；`scope` 为管理元数据，`iuse` 安装时把 scoped 规则渲染上 `paths` frontmatter，global 规则原样落地（`iuse cat <name>` 输出安装形态）
```

README「在其他项目/设备使用」命令块 `iuse show` 行后补一行：

```bash
iuse cat <name>                        # 输出渲染后的安装形态（可重定向落盘）
```

- [ ] **Step 5: 验证与 Commit**

Run: `cd packages/meta-cli && bun test tests/prompts.test.ts`
Expected: PASS（无流程短语）

```bash
git add meta README.md .claude/rules/architecture.md
git commit -m "docs: scope renders at assembly time, not baked into rule artifacts"
```

---

### Task 6: 仓库迁移（产物拍平、lock 重建、catalog 重建）

**Files:**
- Move: `rules/global/*.md`、`rules/scoped/*.md` 全部至 `rules/*.md`（scoped 剥离 frontmatter）
- Regenerate: `artifacts.lock.json`、`catalog.json`

**Interfaces:**
- Consumes: Task 1-5 全部代码与契约
- Produces: `imeta status` 全资产 synced 退 0；渲染输出与迁移前产物字节等价

- [ ] **Step 1: 校验 scoped 产物 frontmatter 形态后剥离并拍平**

```bash
cd /Users/xiu/code/infra-ai
for f in rules/scoped/*.md; do
  [[ "$(sed -n '1p' "$f")" == '---' && "$(sed -n '2p' "$f")" == 'paths:' \
     && "$(sed -n '4p' "$f")" == '---' && -z "$(sed -n '5p' "$f")" ]] \
    || { echo "unexpected frontmatter shape: $f"; exit 1; }
done
for f in rules/scoped/*.md; do
  name=$(basename "$f")
  tail -n +6 "$f" > "rules/$name"
  git rm -q "$f"
  git add "rules/$name"
done
git mv rules/global/*.md rules/
rmdir rules/scoped rules/global
```

- [ ] **Step 2: 渲染字节等价验证（HEAD 尚是旧产物）**

```bash
cd /Users/xiu/code/infra-ai
for name in css docs-retrieval markdown nestjs nextjs python react testing typescript; do
  diff <(iuse cat "$name") <(git show "HEAD:rules/scoped/$name.md") \
    || { echo "render mismatch: $name"; exit 1; }
done
for name in agent-behavior ai-sdk constitution context-management database dependencies-ts tooling; do
  diff <(iuse cat "$name") <(git show "HEAD:rules/global/$name.md") \
    || { echo "render mismatch: $name"; exit 1; }
done
echo all-equal
```

Expected: `all-equal`（任何 mismatch 都意味着下游会误报，必须先修 renderRule 再继续）

- [ ] **Step 3: 重建 lock 基线与 catalog**

```bash
cd /Users/xiu/code/infra-ai
rm artifacts.lock.json
for f in meta/rules/*.md meta/skills/*.md meta/templates/*.md; do
  imeta adopt "$(basename "$f" .md)" || exit 1
done
imeta catalog
```

- [ ] **Step 4: 对账验证**

Run: `imeta status; echo "exit=$?"`
Expected: 全部 31 资产 synced，`exit=0`

- [ ] **Step 5: Commit**

```bash
git add rules artifacts.lock.json catalog.json
git commit -m "refactor(rules): flatten artifacts to rules/, strip baked paths frontmatter"
```

---

### Task 7: 全量验证收尾

**Files:**
- 无新改动；只验证

**Interfaces:**
- Consumes: 全部前序任务
- Produces: 三包测试/typecheck/lint 通过；对账与查询命令冒烟通过

- [ ] **Step 1: 三包全量测试**

```bash
cd /Users/xiu/code/infra-ai/packages/meta-cli && bun test && pnpm typecheck && pnpm lint
cd /Users/xiu/code/infra-ai/packages/iuse && bun test && pnpm typecheck && pnpm lint
cd /Users/xiu/code/infra-ai/packages/preview && bun test && pnpm typecheck
```

Expected: 全 PASS（preview 的 api.test.ts 夹具已在 Task 3 的 sed 范围外——如失败，把其 `rules/global` 夹具路径改为 `rules` 后重跑）

- [ ] **Step 2: 命令冒烟**

```bash
imeta status && iuse list | head -5 && iuse cat markdown | head -8 && iuse status --global; echo "global-exit=$?"
```

Expected: status 全 synced；`iuse cat markdown` 首行为 `---`、含 `paths:`；--global 输出建议命令为 `iuse cat markdown > ~/.claude/rules/markdown.md` 形态（本地旧副本 differs 属预期，只读不落地）

- [ ] **Step 3: 已装下游项目抽查（如有）**

任选一个此前 `iuse init` 过的项目：

```bash
iuse status <project>
```

Expected: 迁移前 synced 的规则仍 synced（字节等价验证的最终背书）；如出现整列 outdated，回查 Step 2 的等价验证

- [ ] **Step 4: 收尾 Commit（如冒烟迫使小修）**

```bash
git add -A && git commit -m "test: post-migration smoke fixes"
```

（无修改则跳过。）

## Self-Review 记录

- Spec 覆盖：物化时机后移（Task 3/6）、目录拍平（Task 1/6）、scope 零重建（Task 2）、四条对账路径 render-aware（Task 3 单点吸收 + Task 4 两条旁路）、文档契约同步（Task 5）、下游无感迁移（Task 6 Step 2 字节等价）——均有任务对应
- 类型一致性：`renderRule(scope: string | null, content: string): string` 在 Task 3 定义、Task 4 消费；`catReport` 签名 Task 4 内定义与消费一致
- 已知不做（MVP 裁决）：每项目 paths 覆盖（`--paths-override`）、TUI 内 cat 对应视图、preview 显示渲染形态
