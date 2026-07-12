# meta-cli 运行可观测性 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 `docs/superpowers/specs/2026-07-12-run-observability-design.md`，mutation 动作运行全程落 `.imeta/logs/*.jsonl`（含 claude 原始事件流），失败输出指向日志文件。

**Architecture:** 新增 `src/core/run-log.ts`（pino 同步写 JSONL + retention）；`actions.ts` 增加统一执行入口 `runAction`（query 直通，mutation 包装 hooks 与 ctx.claude 后落日志）；`runClaude` 增加 `onEvent` 钩子透传原始事件；TUI/CLI 改调 `runAction`。

**Tech Stack:** 既有栈 + pino（同步 destination，不用 transport/worker）+ pino-pretty（devDependency，人读）。

## Global Constraints

- 包管理 pnpm；运行与测试 bun（`bun test` 于 `packages/meta-cli/`）
- 源代码禁止 emoji；禁止 `@ts-ignore`；禁止双重断言；禁止 `!` 非空断言（用可选链）；文件名 kebab-case
- commit message 英文，Conventional Commits
- 每任务提交前：full `bun test` + `pnpm --filter @infra-ai/meta-cli typecheck` + `pnpm --filter @infra-ai/meta-cli lint`（零 warning）
- 测试临时目录 `mkdtempSync(join(tmpdir(), 'meta-cli-'))`，测后 `rmSync` 清理
- 日志写入失败不得影响动作本身（event 内部吞错，一次性 stderr 警告）；retention 清理失败静默跳过
- 业务 execute 保持纯净：观测只在 `runAction` 与钩子层，注册表/键位表不变（parity 测试无需改动）
- 既有接口（本计划消费）：`ActionContext { repoRoot, run, now, claude, download }`、`ActionParams { positionals, flags }`、`ActionResult { ok, message?, data?, exitCode? }`、`getAction(id)`、`runClaude(opts: { repoRoot, prompt, allowedTools, timeoutMs?, onText? })`、`verifyBuild`、`recordBuild`、`lockKey`

---

### Task 1: run-log 模块

**Files:**
- Create: `packages/meta-cli/src/core/run-log.ts`
- Modify: `.gitignore`（追加 `.imeta/`）
- Modify: `packages/meta-cli/package.json`（pino 依赖）
- Test: `packages/meta-cli/tests/run-log.test.ts`

**Interfaces:**
- Produces:
  - `interface RunLog { path: string; event: (step: string, data?: Record<string, unknown>) => void; close: () => void }`
  - `const DEFAULT_RETAIN = 50`
  - `createRunLog(repoRoot: string, actionId: string, params: { positionals: string[]; flags: Record<string, boolean> }, now: string, retain?: number): RunLog`
  - 文件名 `<now 压缩>-<actionId 冒号换连字符>-<subject>.jsonl`，subject = 第一个 positional，缺省时 `--stale` 为 `stale`、否则 `run`；时间戳前缀保证文件名按时间字典序排序
  - params 类型结构化内联声明（不 import actions.ts，避免循环依赖）

- [ ] **Step 1: 写失败测试**

`packages/meta-cli/tests/run-log.test.ts`：

```ts
import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRunLog } from '../src/core/run-log'

const NOW = '2026-07-12T09:04:59.969Z'

describe('createRunLog', () => {
  test('writes events as JSONL with runId and action bindings', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      const log = createRunLog(root, 'build', { positionals: ['commit-lite'], flags: {} }, NOW)
      log.event('start', { params: { positionals: ['commit-lite'], flags: {} } })
      log.event('result', { ok: true })
      log.close()
      expect(log.path).toBe(join(root, '.imeta/logs/20260712T090459969Z-build-commit-lite.jsonl'))
      const lines = readFileSync(log.path, 'utf8').trim().split('\n')
      expect(lines).toHaveLength(2)
      const first = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>
      expect(first.step).toBe('start')
      expect(first.action).toBe('build')
      expect(first.runId).toBe('20260712T090459969Z-build-commit-lite')
      const second = JSON.parse(lines[1] ?? '{}') as Record<string, unknown>
      expect(second.step).toBe('result')
      expect(second.ok).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('subject falls back to stale flag then run; colon in action id becomes dash', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      const stale = createRunLog(root, 'build', { positionals: [], flags: { stale: true } }, NOW)
      expect(stale.path.endsWith('-build-stale.jsonl')).toBe(true)
      const update = createRunLog(root, 'skills:update', { positionals: [], flags: {} }, NOW)
      expect(update.path.endsWith('-skills-update-run.jsonl')).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('retention keeps only the newest N files', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      const dir = join(root, '.imeta/logs')
      mkdirSync(dir, { recursive: true })
      for (const stamp of ['20260701T000000000Z', '20260702T000000000Z', '20260703T000000000Z', '20260704T000000000Z']) {
        writeFileSync(join(dir, `${stamp}-build-x.jsonl`), '{}\n')
      }
      const log = createRunLog(root, 'adopt', { positionals: ['foo'], flags: {} }, NOW, 3)
      log.close()
      const files = readdirSync(dir).sort()
      expect(files).toHaveLength(3)
      expect(files[0]).toBe('20260703T000000000Z-build-x.jsonl')
      expect(files[2]?.endsWith('-adopt-foo.jsonl')).toBe(true)
      expect(existsSync(join(dir, '20260701T000000000Z-build-x.jsonl'))).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
cd packages/meta-cli && bun test tests/run-log.test.ts
```

期望：FAIL（模块不存在）。

- [ ] **Step 3: 实现**

```bash
pnpm --filter @infra-ai/meta-cli add pino
pnpm --filter @infra-ai/meta-cli add -D pino-pretty
```

`.gitignore`（仓库根）追加一行 `.imeta/`。

`packages/meta-cli/src/core/run-log.ts`：

```ts
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import pino from 'pino'

export interface RunLog {
  path: string
  event: (step: string, data?: Record<string, unknown>) => void
  close: () => void
}

export const DEFAULT_RETAIN = 50

function cleanup(dir: string, keep: number): void {
  try {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl'))
      .sort()
    for (const f of files.slice(0, Math.max(0, files.length - keep))) {
      rmSync(join(dir, f), { force: true })
    }
  } catch {
    // retention must never block the action
  }
}

export function createRunLog(
  repoRoot: string,
  actionId: string,
  params: { positionals: string[]; flags: Record<string, boolean> },
  now: string,
  retain = DEFAULT_RETAIN,
): RunLog {
  const dir = join(repoRoot, '.imeta', 'logs')
  mkdirSync(dir, { recursive: true })
  cleanup(dir, Math.max(0, retain - 1))
  const subject = params.positionals[0] ?? (params.flags.stale ? 'stale' : 'run')
  const stamp = now.replaceAll('-', '').replaceAll(':', '').replaceAll('.', '')
  const runId = `${stamp}-${actionId.replaceAll(':', '-')}-${subject}`
  const path = join(dir, `${runId}.jsonl`)
  const destination = pino.destination({ dest: path, sync: true })
  const logger = pino(
    { base: { runId, action: actionId }, timestamp: pino.stdTimeFunctions.isoTime },
    destination,
  )
  let warned = false
  return {
    path,
    event(step, data = {}) {
      try {
        logger.info({ step, ...data })
      } catch (error) {
        if (!warned) {
          console.error(`run-log write failed: ${String(error)}`)
          warned = true
        }
      }
    },
    close() {
      try {
        destination.flushSync()
      } catch {
        // sync destination may have nothing to flush
      }
    },
  }
}
```

- [ ] **Step 4: 跑测试确认通过，全量验证，提交**

```bash
bun test tests/run-log.test.ts    # 期望: 3 pass
bun test && pnpm --filter @infra-ai/meta-cli typecheck && pnpm --filter @infra-ai/meta-cli lint
git add packages/meta-cli .gitignore pnpm-lock.yaml
git commit -m "feat(meta-cli): add run-log module with pino JSONL and retention"
```

---

### Task 2: claude 事件透传与 build 链步骤钩子

**Files:**
- Modify: `packages/meta-cli/src/core/claude.ts`（parseStreamJsonLine 返回 raw；runClaude 增加 onEvent）
- Modify: `packages/meta-cli/src/core/actions.ts`（ActionHooks 增加 onStep；buildOne 发 verify/record 步骤）
- Test: `packages/meta-cli/tests/claude.test.ts`（更新期望）、`packages/meta-cli/tests/actions.test.ts`（追加 onStep 测试）

**Interfaces:**
- Produces:
  - `parseStreamJsonLine(line): { type: string; text: string | null; raw: unknown } | null`（新增 `raw` = 解析后的原始对象）
  - `runClaude(opts)` 的 opts 新增 `onEvent?: (raw: unknown) => void`，每解析出一行事件（含结尾 flush 的尾行）先回调 onEvent 再按 text 回调 onText
  - `ActionHooks` 新增 `onStep?: (step: string, data?: Record<string, unknown>) => void`
  - `buildOne` 在 verifyBuild 后调用 `hooks?.onStep?.('verify', { ok, error? })`，在 recordBuild 后调用 `hooks?.onStep?.('record', { key: lockKey(asset) })`

- [ ] **Step 1: 更新/追加失败测试**

`packages/meta-cli/tests/claude.test.ts` 中 `describe('parseStreamJsonLine')` 三个断言更新为：

```ts
  test('assistant event yields concatenated text blocks', () => {
    const payload = {
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'hello' }, { type: 'tool_use', name: 'Write' }] },
    }
    const line = JSON.stringify(payload)
    expect(parseStreamJsonLine(line)).toEqual({ type: 'assistant', text: 'hello', raw: payload })
  })
  test('result event has type result', () => {
    const payload = { type: 'result', result: 'done' }
    const line = JSON.stringify(payload)
    expect(parseStreamJsonLine(line)).toEqual({ type: 'result', text: 'done', raw: payload })
  })
  test('blank or invalid lines yield null', () => {
    expect(parseStreamJsonLine('')).toBeNull()
    expect(parseStreamJsonLine('not json')).toBeNull()
  })
```

（原「其它 type」路径若有断言同样补 `raw`。）

`packages/meta-cli/tests/actions.test.ts` 在 build describe 内追加：

```ts
  test('build emits verify and record steps via onStep', async () => {
    const root = fixtureRepo()
    try {
      const claude: ActionContext['claude'] = async () => {
        mkdirSync(join(root, 'rules/global'), { recursive: true })
        writeFileSync(join(root, 'rules/global/foo.md'), '# built\n')
        return { code: 0, timedOut: false, stderr: '' }
      }
      const steps: [string, Record<string, unknown> | undefined][] = []
      const result = await getAction('build').execute(
        testContext(root, { claude }),
        { positionals: ['foo'], flags: {} },
        { onStep: (step, data) => steps.push([step, data]) },
      )
      expect(result.ok).toBe(true)
      expect(steps[0]?.[0]).toBe('verify')
      expect(steps[0]?.[1]?.ok).toBe(true)
      expect(steps[1]?.[0]).toBe('record')
      expect(steps[1]?.[1]?.key).toBe('rule:foo')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
```

- [ ] **Step 2: 跑测试确认失败**

```bash
bun test tests/claude.test.ts tests/actions.test.ts
```

期望：parse 三条与 onStep 一条 FAIL。

- [ ] **Step 3: 实现**

`packages/meta-cli/src/core/claude.ts`：

parseStreamJsonLine 返回类型与三个 return 增加 `raw`：

```ts
export function parseStreamJsonLine(
  line: string,
): { type: string; text: string | null; raw: unknown } | null {
  const trimmed = line.trim()
  if (trimmed === '') return null
  let raw: unknown
  try {
    raw = JSON.parse(trimmed)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null || typeof (raw as { type?: unknown }).type !== 'string') {
    return null
  }
  const event = raw as { type: string; message?: { content?: unknown }; result?: unknown }
  if (event.type === 'assistant' && Array.isArray(event.message?.content)) {
    const text = event.message.content
      .filter(
        (b): b is { type: string; text: string } =>
          typeof b === 'object' && b !== null && (b as { type?: unknown }).type === 'text',
      )
      .map((b) => b.text)
      .join('')
    return { type: 'assistant', text: text === '' ? null : text, raw }
  }
  if (event.type === 'result') {
    return { type: 'result', text: typeof event.result === 'string' ? event.result : null, raw }
  }
  return { type: event.type, text: null, raw }
}
```

runClaude 的 opts 增加 `onEvent?: (raw: unknown) => void`；stdout 循环与 close 时的
尾行 flush 统一改为：

```ts
      for (const line of lines) {
        const event = parseStreamJsonLine(line)
        if (event) {
          opts.onEvent?.(event.raw)
          if (event.text) opts.onText?.(event.text)
        }
      }
```

（flush 处同样先 `opts.onEvent?.(event.raw)` 再 text。）

`packages/meta-cli/src/core/actions.ts`：

```ts
export interface ActionHooks {
  onText?: (t: string) => void
  onStep?: (step: string, data?: Record<string, unknown>) => void
}
```

buildOne 改为：

```ts
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
  if (err === null) {
    hooks?.onStep?.('verify', { ok: true })
  } else {
    hooks?.onStep?.('verify', { ok: false, error: err })
    return err
  }
  recordBuild(ctx.repoRoot, asset, ctx.now())
  hooks?.onStep?.('record', { key: lockKey(asset) })
  return null
}
```

- [ ] **Step 4: 验证并提交**

```bash
bun test && pnpm --filter @infra-ai/meta-cli typecheck && pnpm --filter @infra-ai/meta-cli lint
git add packages/meta-cli/src/core packages/meta-cli/tests
git commit -m "feat(meta-cli): expose raw claude events and build-step hooks"
```

---

### Task 3: runAction 统一执行入口

**Files:**
- Modify: `packages/meta-cli/src/core/actions.ts`
- Test: `packages/meta-cli/tests/actions.test.ts`（追加 runAction describe）

**Interfaces:**
- Consumes: Task 1 `createRunLog`、Task 2 `onEvent`/`onStep`
- Produces:
  - `interface RunActionResult extends ActionResult { logPath?: string }`
  - `runAction(ctx: ActionContext, id: string, params: ActionParams, hooks?: ActionHooks): Promise<RunActionResult>`
  - query 直通 execute（无日志、无 logPath）；mutation 落日志并返回 logPath

- [ ] **Step 1: 追加失败测试**

`packages/meta-cli/tests/actions.test.ts`（import 增加 `runAction`；`existsSync` 已有）：

```ts
describe('runAction', () => {
  test('mutation writes a run log with the full step sequence', async () => {
    const root = fixtureRepo()
    try {
      const claude: ActionContext['claude'] = async (opts) => {
        mkdirSync(join(root, 'rules/global'), { recursive: true })
        writeFileSync(join(root, 'rules/global/foo.md'), '# built\n')
        opts.onEvent?.({ type: 'assistant', message: { content: [{ type: 'text', text: 'hi' }] } })
        opts.onText?.('hi')
        return { code: 0, timedOut: false, stderr: '' }
      }
      const result = await runAction(testContext(root, { claude }), 'build', {
        positionals: ['foo'],
        flags: {},
      })
      expect(result.ok).toBe(true)
      expect(result.logPath).toBeDefined()
      const lines = readFileSync(result.logPath ?? '', 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l) as Record<string, unknown>)
      const steps = lines.map((l) => l.step)
      expect(steps).toEqual(['start', 'claude:spawn', 'claude:event', 'text', 'claude:exit', 'verify', 'record', 'result'])
      expect(lines.every((l) => l.action === 'build')).toBe(true)
      const spawn = lines[1]
      expect(String(spawn?.prompt)).toContain('meta/rules/foo.md')
      expect(String(spawn?.allowedTools)).toContain('Write(rules/**)')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('failed mutation still returns logPath and logs a failed result', async () => {
    const root = fixtureRepo()
    try {
      const claude: ActionContext['claude'] = async () => ({ code: 1, timedOut: false, stderr: 'boom' })
      const result = await runAction(testContext(root, { claude }), 'build', {
        positionals: ['foo'],
        flags: {},
      })
      expect(result.ok).toBe(false)
      expect(result.logPath).toBeDefined()
      const lines = readFileSync(result.logPath ?? '', 'utf8')
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l) as Record<string, unknown>)
      const last = lines.at(-1)
      expect(last?.step).toBe('result')
      expect(last?.ok).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('query actions produce no log directory', async () => {
    const root = fixtureRepo()
    try {
      const result = await runAction(testContext(root), 'status', { positionals: [], flags: {} })
      expect(result.ok).toBe(true)
      expect(result.logPath).toBeUndefined()
      expect(existsSync(join(root, '.imeta'))).toBe(false)
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

期望：runAction describe FAIL（未导出）。

- [ ] **Step 3: 实现**

`packages/meta-cli/src/core/actions.ts`（import 增加 `import { createRunLog } from './run-log'`）：

```ts
export interface RunActionResult extends ActionResult {
  logPath?: string
}

export async function runAction(
  ctx: ActionContext,
  id: string,
  params: ActionParams,
  hooks?: ActionHooks,
): Promise<RunActionResult> {
  const action = getAction(id)
  if (action.kind === 'query') return action.execute(ctx, params, hooks)
  const runLog = createRunLog(ctx.repoRoot, id, params, ctx.now())
  runLog.event('start', { params })
  const wrappedHooks: ActionHooks = {
    onText: (t) => {
      runLog.event('text', { text: t })
      hooks?.onText?.(t)
    },
    onStep: (step, data) => {
      runLog.event(step, data)
      hooks?.onStep?.(step, data)
    },
  }
  const claude: ActionContext['claude'] = (opts) => {
    runLog.event('claude:spawn', { prompt: opts.prompt, allowedTools: opts.allowedTools })
    return ctx
      .claude({ ...opts, onEvent: (raw) => runLog.event('claude:event', { event: raw }) })
      .then((res) => {
        runLog.event('claude:exit', {
          code: res.code,
          timedOut: res.timedOut,
          stderr: res.stderr.slice(-2000),
        })
        return res
      })
  }
  try {
    const result = await action.execute({ ...ctx, claude }, params, wrappedHooks)
    runLog.event('result', { ok: result.ok, message: result.message, exitCode: result.exitCode })
    return { ...result, logPath: runLog.path }
  } catch (error) {
    runLog.event('error', { error: String(error) })
    throw error
  } finally {
    runLog.close()
  }
}
```

- [ ] **Step 4: 验证并提交**

```bash
bun test && pnpm --filter @infra-ai/meta-cli typecheck && pnpm --filter @infra-ai/meta-cli lint
git add packages/meta-cli/src/core/actions.ts packages/meta-cli/tests/actions.test.ts
git commit -m "feat(meta-cli): add runAction entry with per-run JSONL logging"
```

---

### Task 4: TUI/CLI 接入与失败指路

**Files:**
- Modify: `packages/meta-cli/src/cli/index.ts`
- Modify: `packages/meta-cli/src/tui/app.tsx`
- Modify: `packages/meta-cli/src/tui/skills-view.tsx`
- Modify: `.claude/rules/architecture.md`
- Test: `packages/meta-cli/tests/cli.test.ts`（失败路径断言）

**Interfaces:**
- Consumes: Task 3 `runAction`、`RunActionResult`
- Produces: TUI/CLI 全部 mutation 调用经 `runAction`；失败输出含 `log: <path>`

- [ ] **Step 1: 追加失败测试（CLI e2e）**

`packages/meta-cli/tests/cli.test.ts` 的 adopt e2e 失败断言追加一行：

```ts
      expect(bad.stderr).toContain('log: ')
      expect(bad.stderr).toContain('.imeta/logs/')
```

```bash
bun test tests/cli.test.ts    # 期望: 该测试 FAIL（stderr 尚无 log: 行）
```

- [ ] **Step 2: CLI 接入**

`packages/meta-cli/src/cli/index.ts`：import 改为 `import { ACTIONS, defaultContext, runAction } from '../core/actions'`；
commandFor 的 run handler 中 `action.execute(...)` 调用替换为：

```ts
      const result = await runAction(defaultContext(process.cwd()), action.id, params, {
        onText: (t) => console.log(t),
      })
      if (!result.ok) {
        console.error(result.message ?? 'failed')
        if (result.logPath) console.error(`log: ${result.logPath}`)
      } else if (action.kind === 'query') {
```

（else 分支与 exitCode 行保持不变。）

- [ ] **Step 3: TUI 接入**

`packages/meta-cli/src/tui/app.tsx`：import 改 `import { defaultContext, runAction } from '../core/actions'`
（`getAction` 不再需要）；四个处理器（a/b/B/w）的
`getAction('<id>').execute(ctx, <params>, ...)` 统一替换为
`runAction(ctx, '<id>', <params>, ...)`，`.then` 回调统一改为：

```tsx
          .then((r) => {
            if (r.ok && r.message) onText(r.message)
            return r.ok ? null : `${r.message ?? 'failed'}${r.logPath ? `\nlog: ${r.logPath}` : ''}`
          })
```

`packages/meta-cli/src/tui/skills-view.tsx`：import 同样换 `runAction`；
`f`/`u` 处理器的 `getAction('skills:fix').execute(ctx, ...)` / `getAction('skills:update').execute(ctx, ...)`
替换为 `runAction(ctx, 'skills:fix', ...)` / `runAction(ctx, 'skills:update', ...)`；
两处 `.then((r) => ...)` 里设置 notice 的地方，失败时改为
`setNotice(`${r.message ?? 'failed'}（log: ${r.logPath ?? ''}）`)`，成功分支不变。

- [ ] **Step 4: 文档**

`.claude/rules/architecture.md` 「对账」节末尾追加：

```markdown
- mutation 动作运行留痕 `.imeta/logs/*.jsonl`（git-ignored，留最近 50 次，
  含 claude 原始事件流）；失败输出附 `log: <path>` 指向现场
```

- [ ] **Step 5: 全量验证并提交**

```bash
bun test && pnpm --filter @infra-ai/meta-cli typecheck && pnpm --filter @infra-ai/meta-cli lint
cd /Users/xiu/code/infra-ai && imeta adopt nope; echo "exit=$?"   # 期望: stderr 报 unknown asset + log: .imeta/logs/... , exit=1
ls .imeta/logs/ | tail -3                                          # 期望: 出现 adopt-nope 日志
pnpm meta </dev/null 2>&1 | head -12                               # 期望: 首帧正常
git add packages/meta-cli
git add -f .claude/rules/architecture.md
git commit -m "feat(meta-cli): route frontends through runAction with failure log paths"
```

---

## Self-Review 记录

- Spec 覆盖：Decision 1/6（Task 3 runAction query 直通）、2（Task 2 onEvent 原始事件 + Task 3 claude:event）、
  3（Task 1 落盘/命名/retention/.gitignore）、4（Task 1 pino 同步 destination + base 绑定）、
  5（Task 1-3 事件模型全集：start/claude:spawn/claude:event/claude:exit/verify/record/text/result/error）、
  7（Task 4 失败指路 + pino-pretty devDep）；Error Handling（Task 1 event 吞错与 retention 静默）。
- 类型一致性：`RunLog`/`createRunLog`/`onEvent`/`onStep`/`RunActionResult`/`runAction` 在
  Interfaces、实现与测试间签名一致；`parseStreamJsonLine` 的 raw 字段更新同步到既有测试。
- 已知细节：pino 的 base 字段与 `{ step, ...data }` 合并后行内字段平铺，测试按平铺断言；
  `stamp` 由 `ctx.now()`（ISO 字符串）确定性生成，测试可复现。
