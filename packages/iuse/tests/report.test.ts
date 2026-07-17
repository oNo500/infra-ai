import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInit } from '../src/core/init'
import type { IuseContext } from '../src/core/init'
import { statusReport } from '../src/core/report'

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-report-src-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  mkdirSync(join(dir, 'rules', 'global'), { recursive: true })
  mkdirSync(join(dir, 'templates'), { recursive: true })
  writeFileSync(join(dir, 'meta', 'tags.json'), JSON.stringify({ concern: { exclusive: false, values: { core: 'x' } } }))
  writeFileSync(
    join(dir, 'meta', 'rules', 'constitution.md'),
    '---\nname: constitution\nstatus: ready\nscope: global\ntags: [core]\n---\nbody',
  )
  writeFileSync(join(dir, 'rules', 'global', 'constitution.md'), '# Constitution\n')
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution'] } }))
  writeFileSync(join(dir, 'templates', 'settings.json'), JSON.stringify({ model: 'sonnet' }))
  writeFileSync(join(dir, 'templates', 'architecture.md'), '# [PROJECT_NAME] - Architecture\n\nbody\n')
  writeFileSync(join(dir, 'templates', 'claude-md.md'), '# [PROJECT_NAME]\n\nbody\n')
  mkdirSync(join(dir, 'meta', 'prompts'), { recursive: true })
  writeFileSync(join(dir, 'meta', 'prompts', 'template-instantiate.md'), '# contract\n')
  return dir
}

function addRule(source: string, name: string, ruleBody: string, tags: string[] = ['core']): void {
  writeFileSync(
    join(source, 'meta', 'rules', `${name}.md`),
    `---\nname: ${name}\nstatus: ready\nscope: global\ntags: [${tags.join(', ')}]\n---\nbody`,
  )
  writeFileSync(join(source, 'rules', 'global', `${name}.md`), ruleBody)
}

function setProfileRules(source: string, rules: string[]): void {
  writeFileSync(join(source, 'profiles.json'), JSON.stringify({ demo: { rules } }))
}

function fakeClaudeWriting(): IuseContext['claude'] {
  return async (opts) => {
    const match = /Write\((.+)\)/u.exec(opts.allowedTools)
    const targetFile = match?.[1]
    if (targetFile === undefined) throw new Error('no target file in allowedTools')
    writeFileSync(targetFile, targetFile.endsWith('architecture.md') ? '# demo - Architecture\n\nbody\n' : '# demo\n\nbody\n')
    return { code: 0, timedOut: false, stderr: '' }
  }
}

function ctxWith(now: () => string = () => '2026-07-17T00:00:00Z'): IuseContext {
  return {
    download: async () => ({}),
    run: async () => ({ code: 0, stdout: 'head1\n', stderr: '' }),
    claude: fakeClaudeWriting(),
    now,
    env: {},
    home: '/nope',
    cacheDir: '/tmp/iuse-cache',
  }
}

async function initTarget(source: string): Promise<string> {
  const target = mkdtempSync(join(tmpdir(), 'iuse-report-tgt-'))
  const result = await runInit(ctxWith(), { source, profile: 'demo', target, force: false })
  if (!result.ok) throw new Error(`fixture init failed: ${result.message}`)
  return target
}

describe('statusReport', () => {
  test('no lock at target fails pointing at init', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-report-tgt-'))

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('iuse init')
    expect(result.rows).toEqual([])
    expect(result.exitCode).toBe(1)
  })

  test('source resolution failure returns ok:false with the error message instead of throwing', async () => {
    const badSource = mkdtempSync(join(tmpdir(), 'iuse-report-badsrc-'))
    const target = await initTarget(fixtureSource())

    const result = await statusReport(ctxWith(), { source: badSource, target })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('profiles.json not found')
    expect(result.rows).toEqual([])
    expect(result.exitCode).toBe(1)
  })

  test('rejecting download for a gh: source returns ok:false with the rejection message', async () => {
    const target = await initTarget(fixtureSource())
    const ctx: IuseContext = {
      ...ctxWith(),
      download: async () => {
        throw new Error('network unreachable')
      },
    }

    const result = await statusReport(ctx, { source: 'gh:someorg/somerepo', target })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('network unreachable')
    expect(result.rows).toEqual([])
    expect(result.exitCode).toBe(1)
  })

  test('freshly initialized target is fully synced, exit 0', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.ok).toBe(true)
    expect(result.rows).toEqual([{ rule: 'constitution', state: 'synced' }])
    expect(result.exitCode).toBe(0)
  })

  test('locally edited rule reports modified', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(target, '.claude/rules/constitution.md'), '# Constitution\n\nlocally edited\n')

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.rows).toEqual([{ rule: 'constitution', state: 'modified' }])
    expect(result.exitCode).toBe(1)
  })

  test('source moved on, local untouched -> outdated', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(source, 'rules', 'global', 'constitution.md'), '# Constitution\n\nv2\n')

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.rows).toEqual([{ rule: 'constitution', state: 'outdated' }])
    expect(result.exitCode).toBe(1)
  })

  test('local copy deleted -> missing', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    rmSync(join(target, '.claude/rules/constitution.md'))

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.rows).toEqual([{ rule: 'constitution', state: 'missing' }])
    expect(result.exitCode).toBe(1)
  })

  test('rule newly added to the profile in source surfaces as outdated', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.rows).toEqual([
      { rule: 'constitution', state: 'synced' },
      { rule: 'extra', state: 'outdated' },
    ])
    expect(result.exitCode).toBe(1)
  })

  test('rule removed from source profile still reports (as outdated) rather than vanishing', async () => {
    const source = fixtureSource()
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])
    const target = await initTarget(source)

    setProfileRules(source, ['constitution'])

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.rows).toEqual([
      { rule: 'constitution', state: 'synced' },
      { rule: 'extra', state: 'outdated' },
    ])
    expect(result.exitCode).toBe(1)
  })

  test('composition violations fail the report', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(source, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution', 'ghost'] } }))

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('ghost')
    expect(result.exitCode).toBe(1)
  })
})
