import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderJson } from '../src/cli/index'
import type { ActionStep, IuseContext } from '../src/core/init'
import { runInit } from '../src/core/init'
import { profilesReport } from '../src/core/profiles-report'
import { statusReport } from '../src/core/report'

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
