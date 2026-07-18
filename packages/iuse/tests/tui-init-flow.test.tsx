import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { render } from 'ink-testing-library'
import { App } from '../src/tui/app'
import type { TuiDeps } from '../src/tui/app'
import type { IuseContext } from '../src/core/init'

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
    join(dir, 'profiles.json'),
    JSON.stringify({
      'python-cli': { description: 'Python CLI profile', rules: ['constitution'] },
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
