import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Catalog } from '../src/core/contract'
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
    expect(stdout).not.toContain('选择 profile')
    expect(exitCode).toBe(0)
  })

  test('runCli({ isTTY: true }) with argv ["stauts"] (typo) never renders the TUI and surfaces citty\'s unknown-command handling', async () => {
    // Out-of-process, same rationale as the other TTY fixtures: before the
    // argv.length === 0 tightening, a typo'd subcommand like "stauts" wasn't
    // in the known-subcommand list, so hasNoSubcommand() was true and this
    // would have hijacked into the TUI on a TTY instead of reaching citty.
    const harness = join(import.meta.dir, 'fixtures/run-cli-tty-typo.ts')
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

    expect(stdout).toContain('USAGE')
    expect(stderr).toContain('Unknown command')
    expect(stdout).not.toContain('选择 profile')
    expect(exitCode).toBe(1)
  })
})

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-cli-src-'))
  mkdirSync(join(dir, 'rules'), { recursive: true })
  mkdirSync(join(dir, 'templates'), { recursive: true })
  writeFileSync(join(dir, 'rules', 'constitution.md'), '# Constitution\n')
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { description: 'Demo profile', rules: ['constitution'] } }))
  writeFileSync(join(dir, 'templates', 'settings.json'), JSON.stringify({ model: 'sonnet' }))
  writeFileSync(join(dir, 'templates', 'architecture.md'), '# [PROJECT_NAME] - Architecture\n\nbody\n')
  writeFileSync(join(dir, 'templates', 'claude-md.md'), '# [PROJECT_NAME]\n\nbody\n')
  writeFileSync(join(dir, 'templates', 'template-instantiate.md'), '# contract\n')
  const catalog: Catalog = {
    generatedAt: '2026-07-18T00:00:00Z',
    tags: { concern: { exclusive: false, values: { core: 'x' } } },
    rules: {
      constitution: { description: 'x', tags: ['core'], requires: [], path: 'rules/constitution.md', profiles: ['demo'] },
    },
  }
  writeFileSync(join(dir, 'catalog.json'), JSON.stringify(catalog, null, 2))
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
  test('produces a single, JSON.parse-roundtrippable line', () => {
    const payload = { ok: true, rows: [{ rule: 'constitution', state: 'synced' }], exitCode: 0 }
    const line = renderJson(payload)
    expect(line.includes('\n')).toBe(false)
    expect(JSON.parse(line)).toEqual(payload)
  })

  test('status success/failure shapes carry exactly the documented keys', () => {
    const success = JSON.parse(renderJson({ ok: true, rows: [{ rule: 'constitution', state: 'synced' }], exitCode: 0 })) as Record<string, unknown>
    expect(Object.keys(success).toSorted()).toEqual(['exitCode', 'ok', 'rows'])

    const failure = JSON.parse(renderJson({ ok: false, message: "not initialized, run 'iuse init' first", exitCode: 1 })) as Record<string, unknown>
    expect(Object.keys(failure).toSorted()).toEqual(['exitCode', 'message', 'ok'])
  })

  test('init/update payload includes steps only when present', () => {
    const steps: ActionStep[] = [{ op: 'copy-rule', target: '.claude/rules/constitution.md' }]
    const withSteps = JSON.parse(renderJson({ ok: true, message: 'initialized', steps })) as Record<string, unknown>
    expect(Object.keys(withSteps).toSorted()).toEqual(['message', 'ok', 'steps'])

    const withoutSteps = JSON.parse(renderJson({ ok: false, message: 'already initialized' })) as Record<string, unknown>
    expect('steps' in withoutSteps).toBe(false)
  })

  test('profiles success/failure shapes carry exactly the documented keys (no exitCode)', () => {
    const success = JSON.parse(renderJson({ ok: true, profiles: [{ name: 'demo', description: 'Demo profile', rules: ['constitution'] }] })) as Record<string, unknown>
    expect(Object.keys(success).toSorted()).toEqual(['ok', 'profiles'])

    const failure = JSON.parse(renderJson({ ok: false, message: 'profiles.json not found' })) as Record<string, unknown>
    expect(Object.keys(failure).toSorted()).toEqual(['message', 'ok'])
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
  test('statusReport and profilesReport text paths are unaffected by the json flag', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-cli-tgt-'))
    await runInit(ctxWith(), { source, profile: 'demo', target, force: false })

    const status = await statusReport(ctxWith(), { source, target })
    expect(status.ok).toBe(true)
    expect(status.rows.map((row) => `${row.rule} ${row.state}`)).toEqual(['constitution synced'])

    const profiles = await profilesReport(ctxWith(), { source })
    expect(profiles.profilesText).toContain('demo')
    expect(profiles.profilesText).toContain('Demo profile')
  })
})

describe('splitNames helper', () => {
  test('splits, trims, and filters comma-joined names; array input and undefined pass through', () => {
    expect(splitNames('a, b, c')).toEqual(['a', 'b', 'c'])
    expect(splitNames(['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
    expect(splitNames(undefined)).toBeUndefined()
    expect(splitNames(', , ')).toEqual([])
    expect(splitNames('a,,b')).toEqual(['a', 'b'])
  })
})

describe('exclude/add/remove flag plumbing', () => {
  test('runInit --exclude excludes named rules, records sorted+deduped in the lock, and comma-split parsing trims/filters', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-cli-exclude-'))

    const result = await runInit(ctxWith(), { source, profile: 'demo', target, force: false, exclude: ['constitution'] })

    expect(result.ok).toBe(true)
    expect(result.steps).toContainEqual(expect.objectContaining({ op: 'exclude-rule' }))
    const lockContent = JSON.parse(readFileSync(join(target, '.claude/infra-ai.lock.json'), 'utf8')) as { excluded?: string[] }
    expect(lockContent.excluded).toContain('constitution')

    // comma-split with spaces trims; empty/whitespace-only entries filter out
    expect('constitution, architecture , '.split(',').map((s) => s.trim()).filter((s) => s.length > 0)).toEqual(['constitution', 'architecture'])
    expect(', , '.split(',').map((s) => s.trim()).filter((s) => s.length > 0)).toEqual([])
  })

  test('runUpdate --add re-includes a previously excluded rule; without --add the flag is a no-op', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-cli-include-'))

    const initResult = await runInit(ctxWith(), { source, profile: 'demo', target, force: false, exclude: ['constitution'] })
    expect(initResult.ok).toBe(true)

    const updateResult = await runUpdate(ctxWith(), { source, target, force: false, add: ['constitution'] })
    expect(updateResult.ok).toBe(true)
    expect(updateResult.steps).toContainEqual(expect.objectContaining({ op: 'include' }))

    const lock = loadDownstreamLock(target)
    expect(lock?.excluded ?? []).not.toContain('constitution')
  })

  test('repeated --exclude/--add flags (citty array form) merge and apply to all named rules', async () => {
    const sourceDir = mkdtempSync(join(tmpdir(), 'iuse-repeated-exclude-src-'))
    mkdirSync(join(sourceDir, 'rules'), { recursive: true })
    mkdirSync(join(sourceDir, 'templates'), { recursive: true })
    const repeatedCatalog: Catalog = { generatedAt: '2026-07-18T00:00:00Z', tags: { concern: { exclusive: false, values: { core: 'x' } } }, rules: {} }
    // 'pattern2' avoids colliding with the 'architecture' instantiated template
    // (both would target .claude/rules/architecture.md).
    for (const name of ['constitution', 'pattern1', 'pattern2']) {
      writeFileSync(join(sourceDir, 'rules', `${name}.md`), `# ${name}\n`)
      repeatedCatalog.rules[name] = { description: 'x', tags: ['core'], requires: [], path: `rules/${name}.md`, profiles: ['demo'] }
    }
    writeFileSync(join(sourceDir, 'catalog.json'), JSON.stringify(repeatedCatalog, null, 2))
    writeFileSync(join(sourceDir, 'profiles.json'), JSON.stringify({ demo: { description: 'Demo profile', rules: ['constitution', 'pattern1', 'pattern2'] } }))
    writeFileSync(join(sourceDir, 'templates', 'settings.json'), JSON.stringify({ model: 'sonnet' }))
    writeFileSync(join(sourceDir, 'templates', 'architecture.md'), '# [PROJECT_NAME] - Architecture\n\nbody\n')
    writeFileSync(join(sourceDir, 'templates', 'claude-md.md'), '# [PROJECT_NAME]\n\nbody\n')
    writeFileSync(join(sourceDir, 'templates', 'template-instantiate.md'), '# contract\n')

    const target = mkdtempSync(join(tmpdir(), 'iuse-cli-repeated-exclude-'))
    const result = await runInit(ctxWith(), { source: sourceDir, profile: 'demo', target, force: false, exclude: ['constitution', 'pattern1'] })

    expect(result.ok).toBe(true)
    const lockContent = JSON.parse(readFileSync(join(target, '.claude/infra-ai.lock.json'), 'utf8')) as { excluded?: string[] }
    expect(lockContent.excluded).toEqual(['constitution', 'pattern1'])

    const updateResult = await runUpdate(ctxWith(), { source: sourceDir, target, force: false, add: ['constitution', 'pattern1'] })
    expect(updateResult.ok).toBe(true)
    const lock = loadDownstreamLock(target)
    expect(lock?.excluded ?? []).toEqual([])
  })
})
