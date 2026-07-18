import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { render } from 'ink-testing-library'
import { App } from '../src/tui/app'
import type { TuiDeps } from '../src/tui/app'
import type { IuseContext } from '../src/core/init'
import { loadDownstreamLock } from '../src/core/manifest'

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-tui-src-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  mkdirSync(join(dir, 'rules', 'global'), { recursive: true })
  mkdirSync(join(dir, 'templates'), { recursive: true })
  mkdirSync(join(dir, 'meta', 'prompts'), { recursive: true })
  writeFileSync(join(dir, 'meta', 'tags.json'), JSON.stringify({ concern: { exclusive: false, values: { core: 'x' } } }))
  writeFileSync(
    join(dir, 'meta', 'rules', 'constitution.md'),
    '---\nname: constitution\nstatus: ready\nscope: global\ntags: [core]\n---\nbody',
  )
  writeFileSync(join(dir, 'rules', 'global', 'constitution.md'), '# Constitution\n')
  writeFileSync(
    join(dir, 'meta', 'rules', 'extra.md'),
    '---\nname: extra\nstatus: ready\nscope: global\ntags: [core]\n---\nbody',
  )
  writeFileSync(join(dir, 'rules', 'global', 'extra.md'), '# Extra\n')
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

/**
 * A fake claude whose first invocation blocks on a manually-releasable gate,
 * so tests can observe the in-flight rendering of a minute-scale
 * 'instantiate' step before it resolves. Subsequent invocations resolve
 * immediately (the second template shouldn't also block, or the test would
 * need to release twice for no reason).
 */
function fakeClaudeGatedOnce(): { claude: IuseContext['claude']; release: () => void } {
  let releaseGate: (() => void) | undefined
  const gate = new Promise<void>((resolve) => {
    releaseGate = resolve
  })
  let firstCall = true
  const claude: IuseContext['claude'] = async (opts) => {
    if (firstCall) {
      firstCall = false
      await gate
    }
    const match = /(?:Write|Edit)\((.+)\)/u.exec(opts.allowedTools)
    const rel = match?.[1]
    if (rel === undefined) throw new Error('no target file in allowedTools')
    const targetFile = join(opts.repoRoot, rel)
    writeFileSync(targetFile, targetFile.endsWith('architecture.md') ? '# demo - Architecture\n\nbody\n' : '# demo\n\nbody\n')
    return { code: 0, timedOut: false, stderr: '' }
  }
  if (releaseGate === undefined) throw new Error('gate executor did not run synchronously')
  return { claude, release: releaseGate }
}

function fakeCtx(overrides: Partial<IuseContext> = {}): IuseContext {
  return {
    download: async () => ({}),
    run: async () => ({ code: 0, stdout: 'head1\n', stderr: '' }),
    claude: fakeClaudeInstant(),
    now: () => '2026-07-18T00:00:00Z',
    env: {},
    home: '/nope',
    cacheDir: mkdtempSync(join(tmpdir(), 'iuse-tui-cache-')),
    ...overrides,
  }
}

/** Local polling helper -- no new dependency, per task brief. */
async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor: timed out')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

describe('TUI init flow', () => {
  test('bare TTY run without lock shows profile picker and previews rules switch on down-arrow', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-tgt-'))
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = render(<App deps={deps} />)

    await waitFor(() => (lastFrame() ?? '').includes('python-cli'))
    expect(lastFrame()).toContain('node-web')
    expect(lastFrame()).toContain('constitution') // rules preview for first (selected) profile

    stdin.write('[B') // down arrow
    await waitFor(() => (lastFrame() ?? '').includes('node-web'))
    // node-web highlighted now; rules preview still shows constitution (both profiles share it)
    expect(lastFrame()).toContain('constitution')
  })

  test('enter shows dry-run plan; enter again runs with progress ticks to success', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-tgt-'))
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = render(<App deps={deps} />)

    await waitFor(() => (lastFrame() ?? '').includes('python-cli'))
    stdin.write('\r') // enter: confirm profile selection

    await waitFor(() => (lastFrame() ?? '').includes('计划预览'))
    expect(lastFrame()).toContain('copy-rule')

    stdin.write('\r') // enter: execute

    await waitFor(() => (lastFrame() ?? '').includes('初始化完成'), 5000)
    expect(lastFrame()).toContain('initialized')
  })

  test('pressing q on the result view exits instead of advancing to status', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-tgt-'))
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = render(<App deps={deps} />)

    await waitFor(() => (lastFrame() ?? '').includes('python-cli'))
    stdin.write('\r') // enter: confirm profile selection
    await waitFor(() => (lastFrame() ?? '').includes('计划预览'))
    stdin.write('\r') // enter: execute
    await waitFor(() => (lastFrame() ?? '').includes('初始化完成'), 5000)

    stdin.write('q')
    // Give the exit path a tick to run; there is no further view transition
    // to wait for, so a short delay stands in for "nothing happened".
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(lastFrame()).toContain('初始化完成')
    expect(lastFrame()).not.toContain('状态')
  })

  test('pressing any other key on the result view advances to the real status view', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-tgt-'))
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = render(<App deps={deps} />)

    await waitFor(() => (lastFrame() ?? '').includes('python-cli'))
    stdin.write('\r') // enter: confirm profile selection
    await waitFor(() => (lastFrame() ?? '').includes('计划预览'))
    stdin.write('\r') // enter: execute
    await waitFor(() => (lastFrame() ?? '').includes('初始化完成'), 5000)

    stdin.write('x')
    await waitFor(() => (lastFrame() ?? '').includes('状态'))
    expect(lastFrame()).toContain('constitution')
  })

  test('in-flight instantiate step shows spinner (no checkmark) and later steps stay pending; releasing the gate completes the run', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-tgt-'))
    const { claude, release } = fakeClaudeGatedOnce()
    const deps: TuiDeps = { ctx: fakeCtx({ claude }), target, source }

    const { lastFrame, stdin } = render(<App deps={deps} />)

    await waitFor(() => (lastFrame() ?? '').includes('python-cli'))
    stdin.write('\r') // enter: confirm profile selection
    await waitFor(() => (lastFrame() ?? '').includes('计划预览'))
    stdin.write('\r') // enter: execute

    // While gated on the first instantiate step: its row shows the spinner
    // liveness text and is not yet checked off, and write-lock (a later
    // step) has not become current either.
    await waitFor(() => (lastFrame() ?? '').includes('claude 实例化中（分钟级）'), 5000)
    const gatedFrame = lastFrame() ?? ''
    const instantiateLine = gatedFrame.split('\n').find((l) => l.includes('claude 实例化中（分钟级）')) ?? ''
    expect(instantiateLine).not.toContain('✓')
    const writeLockLine = gatedFrame.split('\n').find((l) => l.includes('write-lock')) ?? ''
    expect(writeLockLine).not.toContain('claude 实例化中')
    expect(writeLockLine).not.toContain('✓')

    release()

    await waitFor(() => (lastFrame() ?? '').includes('初始化完成'), 5000)
    expect(lastFrame()).toContain('initialized')
  })

  test('unchecking a copy-rule row in the plan excludes it from execution', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-tgt-'))
    const deps: TuiDeps = { ctx: fakeCtx(), target, source }

    const { lastFrame, stdin } = render(<App deps={deps} />)

    await waitFor(() => (lastFrame() ?? '').includes('python-cli'))
    // node-web sorts before python-cli in the picker, so move down to select python-cli first.
    stdin.write('[B') // down arrow
    await waitFor(() => {
      const frame = lastFrame() ?? ''
      const line = frame.split('\n').find((l) => l.includes('>'))
      return line !== undefined && line.includes('python-cli')
    })
    stdin.write('\r') // enter: confirm python-cli (constitution + extra)

    await waitFor(() => (lastFrame() ?? '').includes('计划预览'))
    await waitFor(() => (lastFrame() ?? '').includes('extra.md'))
    const planFrame = lastFrame() ?? ''
    expect(planFrame).toContain('[x]')
    // Both copy-rule rows start checked.
    const constitutionLine = planFrame.split('\n').find((l) => l.includes('constitution.md') && l.includes('copy-rule'))
    const extraLine = planFrame.split('\n').find((l) => l.includes('extra.md') && l.includes('copy-rule'))
    expect(constitutionLine).toContain('[x]')
    expect(extraLine).toContain('[x]')

    // Cursor starts on the first row (constitution); move down once to extra, then uncheck it.
    stdin.write('[B') // down arrow
    stdin.write(' ') // space: uncheck extra
    await waitFor(() => (lastFrame() ?? '').split('\n').some((l) => l.includes('extra.md') && l.includes('[ ]')))

    stdin.write('\r') // enter: execute with extra excluded

    await waitFor(() => (lastFrame() ?? '').includes('初始化完成'), 5000)

    const lock = loadDownstreamLock(target)
    expect(lock?.excluded).toEqual(['extra'])
    expect(existsSync(join(target, '.claude/rules/extra.md'))).toBe(false)
    expect(existsSync(join(target, '.claude/rules/constitution.md'))).toBe(true)
  })

  test('source resolution failure lands in error view with message', async () => {
    const target = mkdtempSync(join(tmpdir(), 'iuse-tui-tgt-'))
    const badSource = mkdtempSync(join(tmpdir(), 'iuse-tui-badsrc-')) // no profiles.json
    const deps: TuiDeps = { ctx: fakeCtx(), target, source: badSource }

    const { lastFrame } = render(<App deps={deps} />)

    await waitFor(() => (lastFrame() ?? '').includes('出错了'))
    const frame = (lastFrame() ?? '').replaceAll('\n', ' ')
    expect(frame).toContain('profiles.json not found')
    expect(frame).toContain('not an infra-ai')
  })
})
