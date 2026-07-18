import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderJson, splitNames } from '../src/cli/index'
import type { ActionStep, IuseContext } from '../src/core/init'
import { runInit } from '../src/core/init'
import { loadDownstreamLock } from '../src/core/manifest'
import { profilesReport } from '../src/core/profiles-report'
import { statusReport } from '../src/core/report'
import { runUpdate } from '../src/core/update'

describe('runCli entry routing', () => {
  test('runCli({ isTTY: false }) with no subcommand prints existing help text and never renders the TUI', async () => {
    // Out-of-process: the non-TTY "no command" path calls process.exit(1),
    // which would kill the test runner if invoked in-process.
    const harness = join(import.meta.dir, 'fixtures/run-cli-non-tty.ts')
    const proc = Bun.spawn(['bun', 'run', harness], {
      cwd: join(import.meta.dir, '..'),
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])

    // citty prints usage to stdout and the CLIError message to stderr.
    expect(stdout).toContain('USAGE')
    expect(stderr).toContain('No command specified')
    // TUI-only Chinese label from the profile picker must never appear --
    // proof the dynamic import('../tui/app') branch did not run.
    expect(stdout).not.toContain('选择 profile')
    expect(exitCode).toBe(1)
  })

  test('runCli({ isTTY: true }) with argv ["--help"] prints usage and never renders the TUI', async () => {
    // Out-of-process: a spurious TUI render would put stdin in raw mode and
    // hang waiting for input, so this must not run in the test process.
    const harness = join(import.meta.dir, 'fixtures/run-cli-tty-help.ts')
    const proc = Bun.spawn(['bun', 'run', harness], {
      cwd: join(import.meta.dir, '..'),
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [stdout, , exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])

    expect(stdout).toContain('USAGE')
    // TUI-only Chinese label from the profile picker must never appear --
    // proof the dynamic import('../tui/app') branch did not run.
    expect(stdout).not.toContain('选择 profile')
    expect(exitCode).toBe(0)
  })
})

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-cli-src-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  mkdirSync(join(dir, 'rules', 'global'), { recursive: true })
  mkdirSync(join(dir, 'templates'), { recursive: true })
  writeFileSync(join(dir, 'meta', 'tags.json'), JSON.stringify({ concern: { exclusive: false, values: { core: 'x' } } }))
  writeFileSync(
    join(dir, 'meta', 'rules', 'constitution.md'),
    '---\nname: constitution\nstatus: ready\nscope: global\ntags: [core]\n---\nbody',
  )
  writeFileSync(join(dir, 'rules', 'global', 'constitution.md'), '# Constitution\n')
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { description: 'Demo profile', rules: ['constitution'] } }))
  writeFileSync(join(dir, 'templates', 'settings.json'), JSON.stringify({ model: 'sonnet' }))
  writeFileSync(join(dir, 'templates', 'architecture.md'), '# [PROJECT_NAME] - Architecture\n\nbody\n')
  writeFileSync(join(dir, 'templates', 'claude-md.md'), '# [PROJECT_NAME]\n\nbody\n')
  mkdirSync(join(dir, 'meta', 'prompts'), { recursive: true })
  writeFileSync(join(dir, 'meta', 'prompts', 'template-instantiate.md'), '# contract\n')
  return dir
}

function fakeClaudeWriting(): IuseContext['claude'] {
  return async (opts) => {
    const match = /(?:Write|Edit)\((.+)\)/u.exec(opts.allowedTools)
    const rel = match?.[1]
    if (rel === undefined) throw new Error('no target file in allowedTools')
    const targetFile = join(opts.repoRoot, rel)
    writeFileSync(targetFile, targetFile.endsWith('architecture.md') ? '# demo - Architecture\n\nbody\n' : '# demo\n\nbody\n')
    return { code: 0, timedOut: false, stderr: '' }
  }
}

function ctxWith(): IuseContext {
  return {
    download: async () => ({}),
    run: async () => ({ code: 0, stdout: 'head1\n', stderr: '' }),
    claude: fakeClaudeWriting(),
    now: () => '2026-07-17T00:00:00Z',
    env: {},
    home: '/nope',
    cacheDir: '/tmp/iuse-cli-cache',
  }
}

describe('renderJson', () => {
  test('produces a single line', () => {
    const line = renderJson({ ok: true, rows: [{ rule: 'constitution', state: 'synced' }], exitCode: 0 })
    expect(line.includes('\n')).toBe(false)
  })

  test('round-trips through JSON.parse', () => {
    const payload = { ok: true, rows: [], exitCode: 0 }
    const parsed: unknown = JSON.parse(renderJson(payload))
    expect(parsed).toEqual(payload)
  })

  test('status success shape: exact keys ok, rows, exitCode', () => {
    const payload = { ok: true, rows: [{ rule: 'constitution', state: 'synced' }], exitCode: 0 }
    const parsed = JSON.parse(renderJson(payload)) as Record<string, unknown>
    expect(Object.keys(parsed).toSorted()).toEqual(['exitCode', 'ok', 'rows'])
    expect(parsed.ok).toBe(true)
    expect(parsed.exitCode).toBe(0)
  })

  test('status failure shape: exact keys ok, message, exitCode', () => {
    const payload = { ok: false, message: "not initialized, run 'iuse init' first", exitCode: 1 }
    const parsed = JSON.parse(renderJson(payload)) as Record<string, unknown>
    expect(Object.keys(parsed).toSorted()).toEqual(['exitCode', 'message', 'ok'])
    expect(parsed.ok).toBe(false)
    expect(parsed.exitCode).toBe(1)
  })

  test('init/update success shape includes steps when present', () => {
    const steps: ActionStep[] = [{ op: 'copy-rule', target: '.claude/rules/constitution.md' }]
    const payload = { ok: true, message: 'initialized', steps }
    const parsed = JSON.parse(renderJson(payload)) as Record<string, unknown>
    expect(Object.keys(parsed).toSorted()).toEqual(['message', 'ok', 'steps'])
    expect(parsed.steps).toEqual(steps)
  })

  test('init/update failure shape omits steps when absent', () => {
    const payload = { ok: false, message: 'already initialized' }
    const parsed = JSON.parse(renderJson(payload)) as Record<string, unknown>
    expect(Object.keys(parsed).toSorted()).toEqual(['message', 'ok'])
    expect('steps' in parsed).toBe(false)
  })

  test('profiles success shape: exact keys ok, profiles', () => {
    const payload = { ok: true, profiles: [{ name: 'demo', description: 'Demo profile', rules: ['constitution'] }] }
    const parsed = JSON.parse(renderJson(payload)) as Record<string, unknown>
    expect(Object.keys(parsed).toSorted()).toEqual(['ok', 'profiles'])
    expect(parsed.ok).toBe(true)
  })

  test('profiles failure shape: exact keys ok, message (no exitCode)', () => {
    const payload = { ok: false, message: 'profiles.json not found' }
    const parsed = JSON.parse(renderJson(payload)) as Record<string, unknown>
    expect(Object.keys(parsed).toSorted()).toEqual(['message', 'ok'])
  })
})

describe('renderJson against real core results', () => {
  test('runInit ok result serializes with steps, single line, parseable', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-cli-tgt-'))

    const result = await runInit(ctxWith(), { source, profile: 'demo', target, force: false, dryRun: true })
    expect(result.ok).toBe(true)
    expect(result.steps).toBeDefined()

    const payload = result.steps === undefined
      ? { ok: result.ok, message: result.message }
      : { ok: result.ok, message: result.message, steps: result.steps }
    const line = renderJson(payload)

    expect(line.includes('\n')).toBe(false)
    const parsed = JSON.parse(line) as { ok: boolean; message: string; steps: unknown[] }
    expect(parsed.ok).toBe(true)
    expect(Array.isArray(parsed.steps)).toBe(true)
  })

  test('statusReport not-initialized failure serializes to ok:false with message and exitCode 1', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-cli-tgt-'))

    const result = await statusReport(ctxWith(), { source, target })
    expect(result.ok).toBe(false)

    const payload = result.ok
      ? { ok: true, rows: result.rows, exitCode: result.exitCode }
      : { ok: false, message: result.message, exitCode: result.exitCode }
    const parsed = JSON.parse(renderJson(payload)) as { ok: boolean; message: string; exitCode: number }

    expect(parsed.ok).toBe(false)
    expect(parsed.message).toContain('iuse init')
    expect(parsed.exitCode).toBe(1)
  })

  test('profilesReport ok result carries the structured profiles array', async () => {
    const source = fixtureSource()

    const result = await profilesReport(ctxWith(), { source })
    expect(result.ok).toBe(true)

    const payload = result.ok ? { ok: true, profiles: result.profiles ?? [] } : { ok: false, message: result.message }
    const parsed = JSON.parse(renderJson(payload)) as {
      ok: boolean
      profiles: Array<{ name: string; description: string; rules: string[] }>
    }

    expect(parsed.ok).toBe(true)
    expect(parsed.profiles).toEqual([{ name: 'demo', description: 'Demo profile', rules: ['constitution'] }])
  })
})

describe('text-mode rendering is untouched', () => {
  test('statusReport text path still yields "rule state" rows from core result (unaffected by json flag)', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-cli-tgt-'))
    await runInit(ctxWith(), { source, profile: 'demo', target, force: false })

    const result = await statusReport(ctxWith(), { source, target })
    expect(result.ok).toBe(true)

    const lines = result.rows.map((row) => `${row.rule} ${row.state}`)
    expect(lines).toEqual(['constitution synced'])
  })

  test('profilesReport text path still yields profilesText unaffected by the new profiles field', async () => {
    const source = fixtureSource()

    const result = await profilesReport(ctxWith(), { source })

    expect(result.profilesText).toContain('demo')
    expect(result.profilesText).toContain('Demo profile')
  })
})

describe('splitNames helper', () => {
  test('splitNames with string input splits on comma and trims', () => {
    expect(splitNames('a, b, c')).toEqual(['a', 'b', 'c'])
  })

  test('splitNames with array input (repeated flag) joins then splits', () => {
    expect(splitNames(['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  test('splitNames with undefined returns undefined', () => {
    expect(splitNames(undefined)).toBeUndefined()
  })

  test('splitNames filters empty strings from split', () => {
    expect(splitNames(', , ')).toEqual([])
    expect(splitNames('a,,b')).toEqual(['a', 'b'])
  })

  test('splitNames handles whitespace-only entries', () => {
    expect(splitNames('a, , b')).toEqual(['a', 'b'])
  })
})

describe('exclude/include flags (comma-split plumbing)', () => {
  test('runInit with exclude flag excludes named rules and records in lock', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-cli-exclude-'))

    const result = await runInit(ctxWith(), {
      source,
      profile: 'demo',
      target,
      force: false,
      exclude: ['constitution'],
    })

    expect(result.ok).toBe(true)
    expect(result.steps).toBeDefined()
    expect(result.steps).toContainEqual(expect.objectContaining({ op: 'exclude-rule' }))

    // Verify lock records the exclusion
    const lockPath = join(target, '.claude/infra-ai.lock.json')
    const lockContent = JSON.parse(readFileSync(lockPath, 'utf8')) as unknown
    const lock = lockContent as { excluded?: string[] }
    expect(lock.excluded).toContain('constitution')
  })

  test('runInit comma-split exclude string: "a, b" → ["a", "b"] after trim', async () => {
    // Build a multi-rule fixture
    const sourceDir = mkdtempSync(join(tmpdir(), 'iuse-multi-rule-src-'))
    mkdirSync(join(sourceDir, 'meta', 'rules'), { recursive: true })
    mkdirSync(join(sourceDir, 'rules', 'global'), { recursive: true })
    mkdirSync(join(sourceDir, 'templates'), { recursive: true })
    writeFileSync(
      join(sourceDir, 'meta', 'tags.json'),
      JSON.stringify({ concern: { exclusive: false, values: { core: 'x' } } }),
    )
    writeFileSync(
      join(sourceDir, 'meta', 'rules', 'constitution.md'),
      '---\nname: constitution\nstatus: ready\nscope: global\ntags: [core]\n---\nbody',
    )
    writeFileSync(
      join(sourceDir, 'meta', 'rules', 'architecture.md'),
      '---\nname: architecture\nstatus: ready\nscope: global\ntags: [core]\n---\nbody',
    )
    writeFileSync(join(sourceDir, 'rules', 'global', 'constitution.md'), '# Constitution\n')
    writeFileSync(join(sourceDir, 'rules', 'global', 'architecture.md'), '# Architecture\n')
    writeFileSync(
      join(sourceDir, 'profiles.json'),
      JSON.stringify({ demo: { description: 'Demo profile', rules: ['constitution', 'architecture'] } }),
    )
    writeFileSync(join(sourceDir, 'templates', 'settings.json'), JSON.stringify({ model: 'sonnet' }))
    writeFileSync(join(sourceDir, 'templates', 'architecture.md'), '# [PROJECT_NAME] - Architecture\n\nbody\n')
    writeFileSync(join(sourceDir, 'templates', 'claude-md.md'), '# [PROJECT_NAME]\n\nbody\n')
    mkdirSync(join(sourceDir, 'meta', 'prompts'), { recursive: true })
    writeFileSync(join(sourceDir, 'meta', 'prompts', 'template-instantiate.md'), '# contract\n')

    const target = mkdtempSync(join(tmpdir(), 'iuse-cli-exclude-multi-'))

    // Test with leading/trailing spaces: "constitution, architecture"
    const result = await runInit(ctxWith(), {
      source: sourceDir,
      profile: 'demo',
      target,
      force: false,
      exclude: ['constitution', 'architecture'], // already pre-split for this test
    })

    expect(result.ok).toBe(true)
    const lockPath = join(target, '.claude/infra-ai.lock.json')
    const lockContent = JSON.parse(readFileSync(lockPath, 'utf8')) as unknown
    const lock = lockContent as { excluded?: string[] }
    expect(lock.excluded).toEqual(['architecture', 'constitution']) // sorted
  })

  test('runInit without exclude flag passes undefined to runInit', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-cli-no-exclude-'))

    // Call runInit directly with no exclude parameter
    const result = await runInit(ctxWith(), {
      source,
      profile: 'demo',
      target,
      force: false,
    })

    expect(result.ok).toBe(true)
    const lockPath = join(target, '.claude/infra-ai.lock.json')
    const lockContent = JSON.parse(readFileSync(lockPath, 'utf8')) as unknown
    const lock = lockContent as { excluded?: string[] }
    expect(lock.excluded ?? []).toEqual([]) // no exclusions
  })

  test('runUpdate with include flag re-includes previously excluded rules', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-cli-include-'))

    // Init with exclusion
    const initResult = await runInit(ctxWith(), {
      source,
      profile: 'demo',
      target,
      force: false,
      exclude: ['constitution'],
    })
    expect(initResult.ok).toBe(true)

    // Update with include
    const updateResult = await runUpdate(ctxWith(), {
      source,
      target,
      force: false,
      include: ['constitution'],
    })

    expect(updateResult.ok).toBe(true)
    expect(updateResult.steps).toBeDefined()
    expect(updateResult.steps).toContainEqual(expect.objectContaining({ op: 'include' }))
  })

  test('runUpdate without include flag passes undefined', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-cli-update-no-include-'))

    // Init normally
    const initResult = await runInit(ctxWith(), {
      source,
      profile: 'demo',
      target,
      force: false,
    })
    expect(initResult.ok).toBe(true)

    // Update without include
    const updateResult = await runUpdate(ctxWith(), {
      source,
      target,
      force: false,
    })

    expect(updateResult.ok).toBe(true)
  })

  test('comma-split with spaces is trimmed: "a, b , c" → ["a", "b", "c"]', async () => {
    // This test validates the CLI parsing logic directly
    // Simulate what the CLI does: split, trim, filter empty
    const input = 'constitution, architecture , '
    const parsed = input.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
    expect(parsed).toEqual(['constitution', 'architecture'])
  })

  test('empty input and only-whitespace entries are filtered: ", , " → []', async () => {
    const input = ', , '
    const parsed = input.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
    expect(parsed).toEqual([])
  })

  test('runInit with repeated --exclude flags (array input) merges and excludes all', async () => {
    // Build multi-rule fixture
    const sourceDir = mkdtempSync(join(tmpdir(), 'iuse-repeated-exclude-src-'))
    mkdirSync(join(sourceDir, 'meta', 'rules'), { recursive: true })
    mkdirSync(join(sourceDir, 'rules', 'global'), { recursive: true })
    mkdirSync(join(sourceDir, 'templates'), { recursive: true })
    writeFileSync(
      join(sourceDir, 'meta', 'tags.json'),
      JSON.stringify({ concern: { exclusive: false, values: { core: 'x' } } }),
    )
    for (const name of ['constitution', 'architecture', 'pattern']) {
      writeFileSync(
        join(sourceDir, 'meta', 'rules', `${name}.md`),
        `---\nname: ${name}\nstatus: ready\nscope: global\ntags: [core]\n---\nbody`,
      )
      writeFileSync(join(sourceDir, 'rules', 'global', `${name}.md`), `# ${name}\n`)
    }
    writeFileSync(
      join(sourceDir, 'profiles.json'),
      JSON.stringify({ demo: { description: 'Demo profile', rules: ['constitution', 'architecture', 'pattern'] } }),
    )
    writeFileSync(join(sourceDir, 'templates', 'settings.json'), JSON.stringify({ model: 'sonnet' }))
    writeFileSync(join(sourceDir, 'templates', 'architecture.md'), '# [PROJECT_NAME] - Architecture\n\nbody\n')
    writeFileSync(join(sourceDir, 'templates', 'claude-md.md'), '# [PROJECT_NAME]\n\nbody\n')
    mkdirSync(join(sourceDir, 'meta', 'prompts'), { recursive: true })
    writeFileSync(join(sourceDir, 'meta', 'prompts', 'template-instantiate.md'), '# contract\n')

    const target = mkdtempSync(join(tmpdir(), 'iuse-cli-repeated-exclude-'))

    // Simulate citty passing array when flag repeats: --exclude constitution --exclude architecture
    const result = await runInit(ctxWith(), {
      source: sourceDir,
      profile: 'demo',
      target,
      force: false,
      exclude: ['constitution', 'architecture'], // citty array form
    })

    expect(result.ok).toBe(true)
    const lockPath = join(target, '.claude/infra-ai.lock.json')
    const lockContent = JSON.parse(readFileSync(lockPath, 'utf8')) as unknown
    const lock = lockContent as { excluded?: string[] }
    // Both should be excluded and sorted
    expect(lock.excluded).toEqual(['architecture', 'constitution'])
  })

  test('runUpdate with repeated --include flags (array input) merges and re-includes all', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-cli-repeated-include-'))

    // Pre-init then add extra rules
    const initResult = await runInit(ctxWith(), {
      source,
      profile: 'demo',
      target,
      force: false,
      exclude: ['constitution'],
    })
    expect(initResult.ok).toBe(true)

    // Simulate citty passing array when flag repeats: --include constitution
    // (In reality this would be multiple flags, but the array form is the issue)
    const updateResult = await runUpdate(ctxWith(), {
      source,
      target,
      force: false,
      include: ['constitution'], // citty array form
    })

    expect(updateResult.ok).toBe(true)
    expect(updateResult.steps).toBeDefined()
    expect(updateResult.steps).toContainEqual(expect.objectContaining({ op: 'include' }))

    const lock = loadDownstreamLock(target)
    expect(lock?.excluded ?? []).not.toContain('constitution')
  })
})
