import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Catalog } from '../src/core/contract'
import { runInit } from '../src/core/init'
import type { IuseContext } from '../src/core/init'
import { loadDownstreamLock, saveDownstreamLock } from '../src/core/manifest'
import { statusReport } from '../src/core/report'

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-report-src-'))
  mkdirSync(join(dir, 'rules'), { recursive: true })
  mkdirSync(join(dir, 'templates'), { recursive: true })
  writeFileSync(join(dir, 'rules', 'constitution.md'), '# Constitution\n')
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution'] } }))
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

function addRule(source: string, name: string, ruleBody: string, tags: string[] = ['core']): void {
  writeFileSync(join(source, 'rules', `${name}.md`), ruleBody)
  const catalog = JSON.parse(readFileSync(join(source, 'catalog.json'), 'utf8')) as Catalog
  catalog.rules[name] = { description: 'x', tags, requires: [], path: `rules/${name}.md`, profiles: ['demo'] }
  writeFileSync(join(source, 'catalog.json'), JSON.stringify(catalog, null, 2))
}

function setProfileRules(source: string, rules: string[]): void {
  writeFileSync(join(source, 'profiles.json'), JSON.stringify({ demo: { rules } }))
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

function ctxWith(now: () => string = () => '2026-07-17T00:00:00Z', overrides: Partial<IuseContext> = {}): IuseContext {
  return {
    download: async () => ({}),
    run: async () => ({ code: 0, stdout: 'head1\n', stderr: '' }),
    claude: fakeClaudeWriting(),
    now,
    env: {},
    home: '/nope',
    cacheDir: '/tmp/iuse-cache',
    ...overrides,
  }
}

async function initTarget(source: string): Promise<string> {
  const target = mkdtempSync(join(tmpdir(), 'iuse-report-tgt-'))
  const result = await runInit(ctxWith(), { source, profile: 'demo', target, force: false })
  if (!result.ok) throw new Error(`fixture init failed: ${result.message}`)
  return target
}

describe('statusReport error paths', () => {
  test('no lock, bad source, missing source catalog, and gh: download rejection all return ok:false with empty rows, exitCode 1', async () => {
    const source = fixtureSource()

    const noLock = await statusReport(ctxWith(), { source, target: mkdtempSync(join(tmpdir(), 'iuse-report-tgt-')) })
    expect(noLock.ok).toBe(false)
    expect(noLock.message).toContain('iuse init')
    expect(noLock.rows).toEqual([])
    expect(noLock.exitCode).toBe(1)

    const target = await initTarget(source)

    const badSource = mkdtempSync(join(tmpdir(), 'iuse-report-badsrc-'))
    const badSourceResult = await statusReport(ctxWith(), { source: badSource, target })
    expect(badSourceResult.ok).toBe(false)
    expect(badSourceResult.message).toContain('profiles.json not found')
    expect(badSourceResult.rows).toEqual([])

    const missingCatalogSource = fixtureSource()
    const missingCatalogTarget = await initTarget(missingCatalogSource)
    unlinkSync(join(missingCatalogSource, 'catalog.json'))
    const missingCatalogResult = await statusReport(ctxWith(), { source: missingCatalogSource, target: missingCatalogTarget })
    expect(missingCatalogResult.ok).toBe(false)
    expect(missingCatalogResult.message).toContain('imeta catalog')
    expect(missingCatalogResult.rows).toEqual([])

    const rejectingCtx: IuseContext = { ...ctxWith(), download: async () => { throw new Error('network unreachable') } }
    const ghResult = await statusReport(rejectingCtx, { source: 'gh:someorg/somerepo', target })
    expect(ghResult.ok).toBe(false)
    expect(ghResult.message).toContain('network unreachable')
    expect(ghResult.rows).toEqual([])
  })
})

describe('statusReport drift states', () => {
  test('freshly initialized target is fully synced, exit 0', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.ok).toBe(true)
    expect(result.rows).toEqual([{ rule: 'constitution', state: 'synced' }])
    expect(result.exitCode).toBe(0)
  })

  test('locally edited -> modified, source moved -> outdated, local deleted -> missing, each exit 1', async () => {
    const editedSource = fixtureSource()
    const editedTarget = await initTarget(editedSource)
    writeFileSync(join(editedTarget, '.claude/rules/constitution.md'), '# Constitution\n\nlocally edited\n')
    const modified = await statusReport(ctxWith(), { source: editedSource, target: editedTarget })
    expect(modified.rows).toEqual([{ rule: 'constitution', state: 'modified' }])
    expect(modified.exitCode).toBe(1)

    const outdatedSource = fixtureSource()
    const outdatedTarget = await initTarget(outdatedSource)
    writeFileSync(join(outdatedSource, 'rules', 'constitution.md'), '# Constitution\n\nv2\n')
    const outdated = await statusReport(ctxWith(), { source: outdatedSource, target: outdatedTarget })
    expect(outdated.rows).toEqual([{ rule: 'constitution', state: 'outdated' }])
    expect(outdated.exitCode).toBe(1)

    const missingSource = fixtureSource()
    const missingTarget = await initTarget(missingSource)
    rmSync(join(missingTarget, '.claude/rules/constitution.md'))
    const missing = await statusReport(ctxWith(), { source: missingSource, target: missingTarget })
    expect(missing.rows).toEqual([{ rule: 'constitution', state: 'missing' }])
    expect(missing.exitCode).toBe(1)
  })

  test('rules-only target (profile "-") reports locked rules without consulting profiles, so a new profile-side rule stays invisible', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-report-tgt-'))
    const initResult = await runInit(ctxWith(), { source, rules: ['constitution'], profile: '-', target, force: false })
    if (!initResult.ok) throw new Error(`fixture init failed: ${initResult.message}`)
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.ok).toBe(true)
    expect(result.rows).toEqual([{ rule: 'constitution', state: 'synced' }])
    expect(result.exitCode).toBe(0)
  })
})

describe('statusReport profile/lock.rules SSoT and exit-code neutrality', () => {
  test('profile-new rule reports available (not outdated) without flipping the exit code', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.ok).toBe(true)
    expect(result.rows).toEqual([
      { rule: 'constitution', state: 'synced' },
      { rule: 'extra', state: 'available' },
    ])
    expect(result.exitCode).toBe(0)
  })

  test('a rule dropped from the source profile but still in lock.rules keeps reporting its normal drift state (lock.rules is SSoT)', async () => {
    const source = fixtureSource()
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])
    const target = await initTarget(source)

    setProfileRules(source, ['constitution'])

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.rows).toEqual([
      { rule: 'constitution', state: 'synced' },
      { rule: 'extra', state: 'synced' },
    ])
    expect(result.exitCode).toBe(0)
  })

  test('excluded rules merge in sorted, report state excluded, and never flip the exit code even when a source-side rule is unrelated to any profile', async () => {
    const source = fixtureSource()
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])
    const target = await initTarget(source)
    const lock = loadDownstreamLock(target)
    if (lock === null) throw new Error('fixture lock missing')
    const { extra: _extra, ...restRules } = lock.rules
    saveDownstreamLock(target, { ...lock, rules: restRules, excluded: ['extra'] })

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.ok).toBe(true)
    expect(result.rows).toEqual([
      { rule: 'constitution', state: 'synced' },
      { rule: 'extra', state: 'excluded' },
    ])
    expect(result.exitCode).toBe(0)
  })

  test('a profile-new rule neither locked nor excluded reports available alongside an unrelated excluded name, exit 0', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])
    const lock = loadDownstreamLock(target)
    if (lock === null) throw new Error('fixture lock missing')
    saveDownstreamLock(target, { ...lock, excluded: ['unrelated-excluded-name'] })

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.rows).toEqual([
      { rule: 'constitution', state: 'synced' },
      { rule: 'extra', state: 'available' },
      { rule: 'unrelated-excluded-name', state: 'excluded' },
    ])
    expect(result.exitCode).toBe(0) // 'extra' available does not drive exit 1
  })

  test('status no longer runs composition validation; a bogus profile rule surfaces as available, not a failure, and disappears entirely if the profile is deleted', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(source, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution', 'ghost'] } }))

    const bogus = await statusReport(ctxWith(), { source, target })
    expect(bogus.ok).toBe(true)
    expect(bogus.rows).toEqual([
      { rule: 'constitution', state: 'synced' },
      { rule: 'ghost', state: 'available' },
    ])
    expect(bogus.exitCode).toBe(0)

    writeFileSync(join(source, 'profiles.json'), JSON.stringify({}))
    const deleted = await statusReport(ctxWith(), { source, target })
    expect(deleted.ok).toBe(true)
    expect(deleted.rows).toEqual([{ rule: 'constitution', state: 'synced' }])
    expect(deleted.exitCode).toBe(0)
  })
})

describe('statusReport duplicates (project vs. global)', () => {
  test('surfaces rules present both in the project lock and $HOME/.claude/rules, without affecting the exit code', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    const fakeHome = mkdtempSync(join(tmpdir(), 'iuse-report-home-'))
    mkdirSync(join(fakeHome, '.claude', 'rules'), { recursive: true })
    writeFileSync(join(fakeHome, '.claude', 'rules', 'constitution.md'), '# Constitution\n')

    const result = await statusReport(ctxWith(undefined, { home: fakeHome }), { source, target })

    expect(result.duplicates).toEqual(['constitution'])
    expect(result.exitCode).toBe(0)
  })
})
