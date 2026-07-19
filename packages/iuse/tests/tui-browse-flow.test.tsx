import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { render } from 'ink-testing-library'
import type { Catalog } from '@infra-ai/meta-cli/core'
import { App } from '../src/tui/app'
import type { TuiDeps } from '../src/tui/app'
import { runInit } from '../src/core/init'
import type { IuseContext } from '../src/core/init'

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-tui-browse-src-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  mkdirSync(join(dir, 'rules'), { recursive: true })
  mkdirSync(join(dir, 'templates'), { recursive: true })
  mkdirSync(join(dir, 'meta', 'prompts'), { recursive: true })
  // Two facets ('concern', 'layer') so the t-cycle test can exercise the full
  // undefined -> concern -> layer -> undefined loop, not just a two-state toggle.
  writeFileSync(
    join(dir, 'meta', 'tags.json'),
    JSON.stringify({
      concern: { exclusive: false, values: { core: 'core concern' } },
      layer: { exclusive: true, values: { backend: 'backend layer' } },
    }),
  )
  writeFileSync(
    join(dir, 'meta', 'rules', 'constitution.md'),
    '---\nname: constitution\nstatus: ready\ndescription: x\nscope: global\ntags: [core]\n---\nbody',
  )
  writeFileSync(join(dir, 'rules', 'constitution.md'), '# Constitution\n')
  writeFileSync(
    join(dir, 'meta', 'rules', 'extra.md'),
    '---\nname: extra\nstatus: ready\ndescription: x\nscope: global\ntags: [backend]\n---\nbody',
  )
  writeFileSync(join(dir, 'rules', 'extra.md'), '# Extra\n')
  writeFileSync(
    join(dir, 'profiles.json'),
    JSON.stringify({
      'python-cli': { description: 'Python CLI profile', rules: ['constitution', 'extra'] },
      'node-web': { description: 'Node web profile', rules: ['constitution'] },
    }),
  )
  writeFileSync(join(dir, 'templates', 'settings.json'), JSON.stringify({ model: 'sonnet' }))
  writeFileSync(join(dir, 'templates', 'architecture.md'), '# [PROJECT_NAME] - Architecture\n\nbody\n')
  writeFileSync(join(dir, 'templates', 'claude-md.md'), '# [PROJECT_NAME]\n\nbody\n')
  writeFileSync(join(dir, 'meta', 'prompts', 'template-instantiate.md'), '# contract\n')

  // catalog.json is the browse view's data source -- handwritten to match the
  // real build shape (imeta catalog output), not derived via buildCatalog, per
  // brief instruction.
  const catalog: Catalog = {
    generatedAt: '2026-07-18T00:00:00Z',
    tags: {
      concern: { exclusive: false, values: { core: 'core concern' } },
      layer: { exclusive: true, values: { backend: 'backend layer' } },
    },
    rules: {
      constitution: {
        description: 'x',
        tags: ['core'],
        scope: 'global',
        path: 'rules/constitution.md',
        profiles: ['node-web', 'python-cli'],
      },
      extra: {
        description: 'x',
        tags: ['backend'],
        scope: 'global',
        path: 'rules/extra.md',
        profiles: ['python-cli'],
      },
    },
  }
  writeFileSync(join(dir, 'catalog.json'), JSON.stringify(catalog, null, 2))

  return dir
}

/**
 * Scroll tests need a right-pane body long enough to overflow the terminal
 * height (24 rows, per the fallback used when ink-testing-library's fake
 * stdout leaves `rows` undefined) -- 80 numbered lines guarantees that no
 * matter the viewport's exact height, some lines start out off-screen.
 */
function fixtureSourceWithLongBody(): string {
  const dir = fixtureSource()
  const lines = Array.from({ length: 80 }, (_, i) => `line-${i + 1}`)
  writeFileSync(join(dir, 'rules', 'constitution.md'), `${lines.join('\n')}\n`)
  return dir
}

/**
 * Left-column windowing test needs a rule count that overflows the visible
 * list height -- 30 rules generated on a single facet-free tag so every row
 * stays visible under the (absent) 't' filter.
 */
function fixtureSourceWithManyRules(count: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-tui-browse-src-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  mkdirSync(join(dir, 'rules'), { recursive: true })
  mkdirSync(join(dir, 'templates'), { recursive: true })
  mkdirSync(join(dir, 'meta', 'prompts'), { recursive: true })
  writeFileSync(join(dir, 'meta', 'tags.json'), JSON.stringify({}))
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({}))
  writeFileSync(join(dir, 'templates', 'settings.json'), JSON.stringify({ model: 'sonnet' }))
  writeFileSync(join(dir, 'templates', 'architecture.md'), '# [PROJECT_NAME] - Architecture\n\nbody\n')
  writeFileSync(join(dir, 'templates', 'claude-md.md'), '# [PROJECT_NAME]\n\nbody\n')
  writeFileSync(join(dir, 'meta', 'prompts', 'template-instantiate.md'), '# contract\n')

  const rules: Catalog['rules'] = {}
  // Zero-padded names so lexicographic (localeCompare) sort matches numeric order.
  for (let i = 0; i < count; i += 1) {
    const name = `rule-${String(i).padStart(2, '0')}`
    writeFileSync(join(dir, 'meta', 'rules', `${name}.md`), `---\nname: ${name}\nstatus: ready\ndescription: x\nscope: global\ntags: []\n---\nbody`)
    writeFileSync(join(dir, 'rules', `${name}.md`), `# ${name}\n`)
    rules[name] = { description: 'x', tags: [], scope: 'global', path: `rules/${name}.md`, profiles: [] }
  }
  const catalog: Catalog = { generatedAt: '2026-07-18T00:00:00Z', tags: {}, rules }
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
    now: () => '2026-07-18T00:00:00Z',
    env: {},
    home: '/nope',
    cacheDir: mkdtempSync(join(tmpdir(), 'iuse-tui-browse-cache-')),
    ...overrides,
  }
}

/**
 * Builds an initialized target where 'extra' is profile-new (in the source
 * profile but never installed) so it lands on the 'available' ListRow state --
 * the state Task 5's `a` action targets.
 */
async function initTargetWithAllStates(source: string): Promise<string> {
  const target = mkdtempSync(join(tmpdir(), 'iuse-tui-browse-tgt-'))
  const result = await runInit(fakeCtx(), { source, profile: 'node-web', target, force: false })
  if (!result.ok) throw new Error(`fixture init failed: ${result.message}`)

  writeFileSync(
    join(source, 'profiles.json'),
    JSON.stringify({
      'python-cli': { description: 'Python CLI profile', rules: ['constitution', 'extra'] },
      'node-web': { description: 'Node web profile', rules: ['constitution', 'extra'] },
    }),
  )

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

/**
 * The TUI now always lands on the home menu first (Task: home menu as the
 * interactive entry) -- an uninitialized target no longer routes straight to
 * browse. This navigates the uninitialized menu's second item
 * ('初始化(自选 rules) / 浏览资产') down to browse, landing on the same
 * catalog-loaded state the old direct-boot tests asserted on.
 */
async function enterBrowseFromHome(stdin: { write: (data: string) => void }, lastFrame: () => string | undefined): Promise<void> {
  await waitFor(() => (lastFrame() ?? '').includes('初始化(选 profile)'))
  await press(stdin, '\x1b[B') // down arrow to '初始化(自选 rules) / 浏览资产'
  await press(stdin, '\r') // enter: browse
  await waitFor(() => (lastFrame() ?? '').includes('constitution'))
}

/**
 * Home's cursor defaults to '状态对账' (the first item) on an initialized
 * target, so a bare enter reaches status -- from there, browse's own 'b' key
 * (asserted by the tests below) is unaffected by the home menu change.
 */
async function enterStatusFromHome(stdin: { write: (data: string) => void }, lastFrame: () => string | undefined): Promise<void> {
  await waitFor(() => (lastFrame() ?? '').includes('状态对账'))
  await press(stdin, '\r') // enter: status (default cursor)
  await waitFor(() => (lastFrame() ?? '').includes('constitution'))
}

describe('TUI browse flow', () => {
  test('bare run on uninitialized target lands on browse with rows and right-pane content', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-browse-tgt-'))
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    await enterBrowseFromHome(stdin, lastFrame)
    expect(lastFrame()).toContain('浏览')
    expect(lastFrame()).toContain('# Constitution')
  })

  test('space selects; enter opens init plan with selected rules', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-browse-tgt-'))
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    await enterBrowseFromHome(stdin, lastFrame)
    await press(stdin, ' ')
    await waitFor(() => (lastFrame() ?? '').includes('[x]'))
    await press(stdin, '\r')
    await waitFor(() => (lastFrame() ?? '').includes('计划预览'))
    expect(lastFrame()).toContain('copy-rule')
  })

  test('t cycles the tag facet through undefined -> concern -> layer -> undefined, filtering rows and annotating the title', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-browse-tgt-'))
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    // No filter: both rows visible.
    await enterBrowseFromHome(stdin, lastFrame)
    expect(lastFrame()).toContain('extra')
    expect(lastFrame()).not.toContain('tag:')

    // First facet (alphabetical: 'concern') -- only constitution carries a
    // 'concern' tag ('core'); extra (tagged 'backend', a 'layer' tag) drops out.
    await press(stdin, 't')
    await waitFor(() => (lastFrame() ?? '').includes('tag: concern'))
    expect(lastFrame()).toContain('constitution')
    expect(lastFrame()).not.toContain('extra')

    // Second facet ('layer') -- only extra carries a 'layer' tag ('backend').
    await press(stdin, 't')
    await waitFor(() => (lastFrame() ?? '').includes('tag: layer'))
    expect(lastFrame()).toContain('extra')
    expect(lastFrame()).not.toContain('constitution')

    // Cycles back to no filter.
    await press(stdin, 't')
    await waitFor(() => !(lastFrame() ?? '').includes('tag:'))
    expect(lastFrame()).toContain('constitution')
    expect(lastFrame()).toContain('extra')
  })

  test('initialized target: status b enters browse; a on available rule reaches update plan', async () => {
    const source = fixtureSource()
    const target = await initTargetWithAllStates(source)
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    await enterStatusFromHome(stdin, lastFrame)
    await press(stdin, 'b')
    await waitFor(() => (lastFrame() ?? '').includes('浏览'))

    // Rows are sorted by name: constitution, extra -- move to the extra row (available).
    await press(stdin, '\x1b[B')
    await waitFor(() => {
      const frame = lastFrame() ?? ''
      const line = frame.split('\n').find((l) => l.includes('>'))
      return line !== undefined && line.includes('extra')
    })
    await press(stdin, 'a')
    await waitFor(() => (lastFrame() ?? '').includes('update 计划预览'))
    expect(lastFrame()).toContain('add')
  })

  test('x on an installed rule reaches update plan with a remove step', async () => {
    const source = fixtureSource()
    const target = await initTargetWithAllStates(source)
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    await enterStatusFromHome(stdin, lastFrame)
    await press(stdin, 'b')
    await waitFor(() => (lastFrame() ?? '').includes('浏览'))

    // Cursor starts on the first row (constitution, installed/synced).
    await press(stdin, 'x')
    await waitFor(() => (lastFrame() ?? '').includes('update 计划预览'))
    expect(lastFrame()).toContain('remove')
  })

  test('esc from browse on an initialized target returns to home', async () => {
    const source = fixtureSource()
    const target = await initTargetWithAllStates(source)
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    await enterStatusFromHome(stdin, lastFrame)
    await press(stdin, 'b')
    await waitFor(() => (lastFrame() ?? '').includes('浏览'))

    await press(stdin, '\x1b') // escape
    await waitFor(() => (lastFrame() ?? '').includes('状态对账'))
  })

  test('p from browse enters profile-picker', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-browse-tgt-'))
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    await enterBrowseFromHome(stdin, lastFrame)
    await press(stdin, 'p')
    await waitFor(() => (lastFrame() ?? '').includes('python-cli'))
    expect(lastFrame()).toContain('选择 profile')
  })

  test('catalog missing on an uninitialized target lands in error view naming imeta catalog', async () => {
    const source = mkdtempSync(join(tmpdir(), 'iuse-tui-browse-nocatalog-'))
    mkdirSync(join(source, 'meta', 'rules'), { recursive: true })
    mkdirSync(join(source, 'rules'), { recursive: true })
    mkdirSync(join(source, 'templates'), { recursive: true })
    writeFileSync(join(source, 'meta', 'tags.json'), JSON.stringify({}))
    writeFileSync(join(source, 'profiles.json'), JSON.stringify({}))
    // Deliberately no catalog.json -- browse's bootstrap must surface this as
    // an actionable error rather than crashing or rendering an empty browse.
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-browse-tgt-'))
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    // Bootstrap no longer eagerly loads browse data -- home renders first
    // regardless, and the missing catalog only surfaces once browse is selected.
    await waitFor(() => (lastFrame() ?? '').includes('初始化(选 profile)'))
    await press(stdin, '\x1b[B') // down arrow to '初始化(自选 rules) / 浏览资产'
    await press(stdin, '\r') // enter: browse

    await waitFor(() => (lastFrame() ?? '').includes('出错了'))
    expect(lastFrame()).toContain('imeta catalog')

    rmSync(source, { recursive: true, force: true })
  })

  test('j scrolls the preview pane down revealing lines past the fold; k scrolls back to reveal the top line', async () => {
    const source = fixtureSourceWithLongBody()
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-browse-tgt-'))
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    await waitFor(() => (lastFrame() ?? '').includes('初始化(选 profile)'))
    await press(stdin, '\x1b[B') // down arrow to '初始化(自选 rules) / 浏览资产'
    await press(stdin, '\r') // enter: browse
    await waitFor(() => (lastFrame() ?? '').includes('line-1'))
    expect(lastFrame()).not.toContain('line-80')

    for (let i = 0; i < 40; i += 1) {
      await press(stdin, 'j')
    }
    await waitFor(() => !(lastFrame() ?? '').includes('line-1\n') && (lastFrame() ?? '').includes('line-4'))

    for (let i = 0; i < 40; i += 1) {
      await press(stdin, 'k')
    }
    await waitFor(() => (lastFrame() ?? '').includes('line-1'))
  })

  test('g jumps the preview pane to the top; G jumps to the bottom', async () => {
    const source = fixtureSourceWithLongBody()
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-browse-tgt-'))
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    await waitFor(() => (lastFrame() ?? '').includes('初始化(选 profile)'))
    await press(stdin, '\x1b[B') // down arrow to '初始化(自选 rules) / 浏览资产'
    await press(stdin, '\r') // enter: browse
    await waitFor(() => (lastFrame() ?? '').includes('line-1'))

    await press(stdin, 'G')
    await waitFor(() => (lastFrame() ?? '').includes('line-80'))

    await press(stdin, 'g')
    await waitFor(() => (lastFrame() ?? '').includes('line-1'))
  })

  test('the position indicator changes as the preview pane scrolls', async () => {
    const source = fixtureSourceWithLongBody()
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-browse-tgt-'))
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    await waitFor(() => (lastFrame() ?? '').includes('初始化(选 profile)'))
    await press(stdin, '\x1b[B') // down arrow to '初始化(自选 rules) / 浏览资产'
    await press(stdin, '\r') // enter: browse
    await waitFor(() => (lastFrame() ?? '').includes('line-1'))
    const before = lastFrame() ?? ''

    await press(stdin, 'G')
    await waitFor(() => (lastFrame() ?? '').includes('line-80'))
    const after = lastFrame() ?? ''

    expect(before).not.toEqual(after)
    // Position indicator format: <起始行>-<结束行>/<总行数>. Total is 81, not 80:
    // the fixture's body ends with a trailing newline, so split('\n') yields
    // one trailing empty line after line-80.
    expect(after).toMatch(/\d+-\d+\/81/u)
  })

  test('left list windows around the cursor: moving to the bottom hides the first rule and shows the last', async () => {
    const source = fixtureSourceWithManyRules(30)
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-browse-tgt-'))
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = bootApp(deps)

    await waitFor(() => (lastFrame() ?? '').includes('初始化(选 profile)'))
    await press(stdin, '\x1b[B') // down arrow to '初始化(自选 rules) / 浏览资产'
    await press(stdin, '\r') // enter: browse
    await waitFor(() => (lastFrame() ?? '').includes('rule-00'))
    expect(lastFrame()).not.toContain('rule-29')

    for (let i = 0; i < 29; i += 1) {
      await press(stdin, '\x1b[B') // down arrow
    }
    await waitFor(() => (lastFrame() ?? '').includes('rule-29'))
    expect(lastFrame()).not.toContain('rule-00')
  })
})
