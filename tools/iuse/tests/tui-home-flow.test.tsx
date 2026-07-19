import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { render } from 'ink-testing-library'
import type { Catalog } from '../src/core/contract'
import { App } from '../src/tui/app'
import type { TuiDeps } from '../src/tui/app'
import { runInit } from '../src/core/init'
import type { IuseContext } from '../src/core/init'

/**
 * Mirrors tui-status-flow.test.tsx's fixtureSource, plus a globals.json
 * declaring 'constitution' as global-scope so the home menu's 全局对账 item
 * has something to reconcile against ~/.claude.
 */
function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-tui-home-src-'))
  mkdirSync(join(dir, 'rules'), { recursive: true })
  mkdirSync(join(dir, 'templates'), { recursive: true })
  writeFileSync(join(dir, 'rules', 'constitution.md'), '# Constitution\n')
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { description: 'Demo profile', rules: ['constitution'] } }))
  writeFileSync(join(dir, 'templates', 'settings.json'), JSON.stringify({ model: 'sonnet' }))
  writeFileSync(join(dir, 'templates', 'architecture.md'), '# [PROJECT_NAME] - Architecture\n\nbody\n')
  writeFileSync(join(dir, 'templates', 'claude-md.md'), '# [PROJECT_NAME]\n\nbody\n')
  writeFileSync(join(dir, 'templates', 'template-instantiate.md'), '# contract\n')
  writeFileSync(join(dir, 'globals.json'), JSON.stringify({ rules: ['constitution'] }))

  const catalog: Catalog = {
    generatedAt: '2026-07-19T00:00:00Z',
    tags: { concern: { exclusive: false, values: { core: 'x' } } },
    rules: {
      constitution: {
        description: 'x',
        tags: ['core'],
        requires: [],
        scope: 'global',
        path: 'rules/constitution.md',
        profiles: ['demo'],
      },
    },
  }
  writeFileSync(join(dir, 'catalog.json'), JSON.stringify(catalog, null, 2))

  return dir
}

function fakeClaudeInstant(): IuseContext['claude'] {
  return async (opts) => {
    const match = /(?:Write|Edit)\((.+)\)/u.exec(opts.allowedTools)
    const rel = match?.[1]
    if (rel === undefined) throw new Error('no target file in allowedTools')
    const targetFile = join(opts.repoRoot, rel)
    writeFileSync(targetFile, targetFile.endsWith('architecture.md') ? '# demo - Architecture\n\nbody\n' : '# demo\n\nbody\n')
    return { code: 0, timedOut: false, stderr: '' }
  }
}

function fakeCtx(overrides: Partial<IuseContext> = {}): IuseContext {
  return {
    download: async () => ({}),
    run: async () => ({ code: 0, stdout: 'head1\n', stderr: '' }),
    claude: fakeClaudeInstant(),
    now: () => '2026-07-19T00:00:00Z',
    env: {},
    home: '/nope',
    cacheDir: mkdtempSync(join(tmpdir(), 'iuse-tui-home-cache-')),
    ...overrides,
  }
}

async function initTarget(source: string): Promise<string> {
  const target = mkdtempSync(join(tmpdir(), 'iuse-tui-home-tgt-'))
  const result = await runInit(fakeCtx(), { source, profile: 'demo', target, force: false })
  if (!result.ok) throw new Error(`fixture init failed: ${result.message}`)
  return target
}

/** 超时诊断：waitFor 失败时带出最后一帧，CI 上无法交互式排障全靠它 */
let lastFrameForDiag: (() => string | undefined) | undefined

function bootApp(deps: TuiDeps): ReturnType<typeof render> {
  const instance = render(<App deps={deps} />)
  lastFrameForDiag = instance.lastFrame
  return instance
}

/**
 * 新视图首帧 commit 后，其 useInput 订阅要等 passive effect flush 才挂上；
 * 见帧就写键会把键写进无监听者的 fake stdin（真实终端有内核缓冲，无此问题）。
 * 写键前让出 50ms，跨过这个空窗。
 */
async function press(stdin: { write: (data: string) => void }, key: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50))
  stdin.write(key)
}

/** Local polling helper -- no new dependency, per task brief. */
async function waitFor(predicate: () => boolean, timeoutMs = 15000): Promise<void> {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`waitFor: timed out; last frame:\n${lastFrameForDiag?.() ?? '<no frame>'}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

describe('TUI home menu flow', () => {
  test('uninitialized target: home shows three items with cursor on the first; enter enters the profile picker; esc returns to home', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-home-tgt-'))
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    await waitFor(() => (lastFrame() ?? '').includes('初始化(选 profile)'))
    const frame = lastFrame() ?? ''
    expect(frame).toContain('初始化(选 profile)')
    expect(frame).toContain('浏览资产')
    expect(frame).toContain('全局对账')
    // Cursor defaults to the first item.
    const firstLine = frame.split('\n').find((l) => l.includes('初始化(选 profile)')) ?? ''
    expect(firstLine).toContain('>')

    await press(stdin, '\r') // enter: first item -> profile picker
    await waitFor(() => (lastFrame() ?? '').includes('选择 profile'))
    expect(lastFrame()).toContain('demo')

    await press(stdin, '\x1b') // escape
    await waitFor(() => (lastFrame() ?? '').includes('初始化(选 profile)'))
  })

  test('uninitialized target: second item enters browse; esc returns to home', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-home-tgt-'))
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    await waitFor(() => (lastFrame() ?? '').includes('初始化(选 profile)'))
    await press(stdin, '\x1b[B') // down arrow to second item
    await press(stdin, '\r') // enter: browse

    // '浏览' alone would also match the home menu's own '浏览资产' label --
    // wait for the browse view's title line specifically instead.
    await waitFor(() => (lastFrame() ?? '').split('\n').some((l) => l.trim().startsWith('浏览')))
    expect(lastFrame()).toContain('constitution')

    await press(stdin, '\x1b') // escape
    await waitFor(() => (lastFrame() ?? '').includes('初始化(选 profile)'))
  })

  test('q on home exits the TUI', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-home-tgt-'))
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin, unmount } = bootApp(deps)

    await waitFor(() => (lastFrame() ?? '').includes('初始化(选 profile)'))
    await press(stdin, 'q')
    await new Promise((resolve) => setTimeout(resolve, 50))

    // No further view transition happens; frame stays on home.
    expect(lastFrame()).toContain('初始化(选 profile)')
    unmount()
  })

  test('initialized target: home defaults cursor to 状态对账; enter enters status; esc returns to home', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    await waitFor(() => (lastFrame() ?? '').includes('状态对账'))
    const frame = lastFrame() ?? ''
    expect(frame).toContain('更新')
    expect(frame).toContain('浏览资产')
    expect(frame).toContain('全局对账')
    const firstLine = frame.split('\n').find((l) => l.includes('状态对账')) ?? ''
    expect(firstLine).toContain('>')

    await press(stdin, '\r') // enter: status
    await waitFor(() => (lastFrame() ?? '').includes('constitution'))
    expect(lastFrame()).toContain('synced')

    await press(stdin, '\x1b') // escape
    await waitFor(() => (lastFrame() ?? '').includes('状态对账'))
  })

  test('initialized target: selecting 更新 goes directly to the update plan', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    await waitFor(() => (lastFrame() ?? '').includes('状态对账'))
    await press(stdin, '\x1b[B') // down arrow to 更新
    await press(stdin, '\r') // enter: update

    await waitFor(() => (lastFrame() ?? '').includes('update 计划预览'))
  })

  test('initialized target: esc from status returns to home', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    await waitFor(() => (lastFrame() ?? '').includes('状态对账'))
    await press(stdin, '\r') // enter: status
    await waitFor(() => (lastFrame() ?? '').includes('constitution'))

    await press(stdin, '\x1b') // escape
    await waitFor(() => (lastFrame() ?? '').includes('状态对账'))
  })

  test('全局对账: shows rows and suggestion for a missing global rule', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-home-tgt-'))
    const home = mkdtempSync(join(tmpdir(), 'iuse-tui-home-fakehome-'))
    const deps: TuiDeps = { ctx: fakeCtx({ home }), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    await waitFor(() => (lastFrame() ?? '').includes('全局对账'))
    // Down-arrow to the 全局对账 item (third on uninitialized menu) and enter.
    await press(stdin, '\x1b[B')
    await press(stdin, '\x1b[B')
    await press(stdin, '\r')

    await waitFor(() => (lastFrame() ?? '').includes('missing'))
    const frame = lastFrame() ?? ''
    const line = frame.split('\n').find((l) => l.includes('constitution')) ?? ''
    expect(line).toContain('missing')
    expect(frame).toContain('iuse cat constitution')

    await press(stdin, '\x1b') // escape
    await waitFor(() => (lastFrame() ?? '').includes('初始化(选 profile)'))
  })

  test('全局对账: globals.json missing at source renders an error frame', async () => {
    // A valid infra-ai source (has profiles.json) but no globals.json declared.
    const source = mkdtempSync(join(tmpdir(), 'iuse-tui-home-bare-src-'))
    writeFileSync(join(source, 'profiles.json'), JSON.stringify({}))
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-home-tgt-'))
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    await waitFor(() => (lastFrame() ?? '').includes('全局对账'))
    await press(stdin, '\x1b[B')
    await press(stdin, '\x1b[B')
    await press(stdin, '\r')

    await waitFor(() => (lastFrame() ?? '').includes('出错了'))
    expect(lastFrame()).toContain('globals.json')
  })
})
