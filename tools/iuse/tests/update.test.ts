import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Catalog } from '../src/core/contract'
import { runInit } from '../src/core/init'
import type { IuseContext } from '../src/core/init'
import { loadDownstreamLock, saveDownstreamLock } from '../src/core/manifest'
import { statusReport } from '../src/core/report'
import { runUpdate } from '../src/core/update'

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-update-src-'))
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
      constitution: { description: 'x', tags: ['core'], requires: [], scope: 'global', path: 'rules/constitution.md', profiles: ['demo'] },
    },
  }
  writeFileSync(join(dir, 'catalog.json'), JSON.stringify(catalog, null, 2))
  return dir
}

function addRule(source: string, name: string, ruleBody: string, tags: string[] = ['core']): void {
  writeFileSync(join(source, 'rules', `${name}.md`), ruleBody)
  const catalog = JSON.parse(readFileSync(join(source, 'catalog.json'), 'utf8')) as Catalog
  catalog.rules[name] = { description: 'x', tags, requires: [], scope: 'global', path: `rules/${name}.md`, profiles: ['demo'] }
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
    // 权限模式是相对项目根的路径，解析基准是 repoRoot（即目标项目）
    const targetFile = join(opts.repoRoot, rel)
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
  const target = mkdtempSync(join(tmpdir(), 'iuse-update-tgt-'))
  const result = await runInit(ctxWith(), { source, profile: 'demo', target, force: false })
  if (!result.ok) throw new Error(`fixture init failed: ${result.message}`)
  return target
}

describe('runUpdate error paths', () => {
  test('no lock, bad source, missing catalog, and gh: download rejection all return ok:false instead of throwing', async () => {
    const source = fixtureSource()

    const noLock = await runUpdate(ctxWith(), { source, target: mkdtempSync(join(tmpdir(), 'iuse-update-tgt-')), force: false })
    expect(noLock.ok).toBe(false)
    expect(noLock.message).toContain('iuse init')

    const target = await initTarget(source)

    const badSource = mkdtempSync(join(tmpdir(), 'iuse-update-badsrc-'))
    const badSourceResult = await runUpdate(ctxWith(), { source: badSource, target, force: false })
    expect(badSourceResult.ok).toBe(false)
    expect(badSourceResult.message).toContain('profiles.json not found')

    const missingCatalogSource = fixtureSource()
    const missingCatalogTarget = await initTarget(missingCatalogSource)
    unlinkSync(join(missingCatalogSource, 'catalog.json'))
    const missingCatalogResult = await runUpdate(ctxWith(), { source: missingCatalogSource, target: missingCatalogTarget, force: false })
    expect(missingCatalogResult.ok).toBe(false)
    expect(missingCatalogResult.message).toContain('imeta catalog')

    const rejectingCtx: IuseContext = { ...ctxWith(), download: async () => { throw new Error('network unreachable') } }
    const ghResult = await runUpdate(rejectingCtx, { source: 'gh:someorg/somerepo', target, force: false })
    expect(ghResult.ok).toBe(false)
    expect(ghResult.message).toContain('network unreachable')
  })
})

describe('runUpdate core drift resolution', () => {
  test('outdated + clean local -> writes new content and refreshes the lock hash/appliedAt/source.locator', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    const lockBefore = loadDownstreamLock(target)
    writeFileSync(join(source, 'rules', 'constitution.md'), '# Constitution\n\nv2\n')

    const result = await runUpdate(ctxWith(() => '2026-08-01T00:00:00Z'), { source, target, force: false })

    expect(result.ok).toBe(true)
    expect(result.message).toContain('constitution: updated')
    expect(readFileSync(join(target, '.claude/rules/constitution.md'), 'utf8')).toBe('# Constitution\n\nv2\n')
    const lock = loadDownstreamLock(target)
    expect(lock?.rules.constitution).not.toBe(undefined)
    expect(lock?.appliedAt).toBe('2026-08-01T00:00:00Z')
    expect(lock?.source.locator).toBe(source)
    expect(lock?.templates).toEqual(lockBefore?.templates)
  })

  test('locally modified rule is skipped by default with a warning and fires onProgress skip-modified', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(target, '.claude/rules/constitution.md'), '# Constitution\n\nlocally edited\n')
    writeFileSync(join(source, 'rules', 'constitution.md'), '# Constitution\n\nv2\n')
    const lockBefore = loadDownstreamLock(target)

    const collectedSteps: Array<{ op: string; target: string; note?: string }> = []
    const result = await runUpdate(ctxWith(), { source, target, force: false, onProgress: (step) => collectedSteps.push(step) })

    expect(result.ok).toBe(true)
    expect(result.message).toContain('constitution: modified locally, skipped')
    expect(result.message).toContain('--force')
    expect(readFileSync(join(target, '.claude/rules/constitution.md'), 'utf8')).toBe('# Constitution\n\nlocally edited\n')
    expect(loadDownstreamLock(target)?.rules.constitution).toBe(lockBefore?.rules.constitution)
    expect(collectedSteps.some((s) => s.op === 'skip-modified' && s.target === '.claude/rules/constitution.md')).toBe(true)
  })

  test('missing local rule is skipped by default with a warning, local copy stays absent', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    rmSync(join(target, '.claude/rules/constitution.md'))

    const result = await runUpdate(ctxWith(), { source, target, force: false })

    expect(result.ok).toBe(true)
    expect(result.message).toContain('constitution: missing locally, skipped')
    expect(existsSync(join(target, '.claude/rules/constitution.md'))).toBe(false)
  })

  test('--force overwrites both a locally modified rule and a missing rule', async () => {
    const source = fixtureSource()
    const modifiedTarget = await initTarget(source)
    writeFileSync(join(modifiedTarget, '.claude/rules/constitution.md'), '# Constitution\n\nlocally edited\n')
    writeFileSync(join(source, 'rules', 'constitution.md'), '# Constitution\n\nv2\n')

    const modifiedResult = await runUpdate(ctxWith(), { source, target: modifiedTarget, force: true })
    expect(modifiedResult.ok).toBe(true)
    expect(modifiedResult.message).toContain('constitution: modified locally, overwritten (--force)')
    expect(readFileSync(join(modifiedTarget, '.claude/rules/constitution.md'), 'utf8')).toBe('# Constitution\n\nv2\n')

    const missingSource = fixtureSource()
    const missingTarget = await initTarget(missingSource)
    rmSync(join(missingTarget, '.claude/rules/constitution.md'))
    const missingResult = await runUpdate(ctxWith(), { source: missingSource, target: missingTarget, force: true })
    expect(missingResult.ok).toBe(true)
    expect(missingResult.message).toContain('constitution: missing locally, overwritten (--force)')
    expect(readFileSync(join(missingTarget, '.claude/rules/constitution.md'), 'utf8')).toBe('# Constitution\n')
  })

  test('--overwrite forces a single named rule via op apply with note (overwrite), without needing global --force', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(target, '.claude/rules/constitution.md'), '# Constitution\n\nlocally edited\n')
    writeFileSync(join(source, 'rules', 'constitution.md'), '# Constitution\n\nv2\n')

    const result = await runUpdate(ctxWith(), { source, target, force: false, overwrite: ['constitution'] })

    expect(result.ok).toBe(true)
    expect(readFileSync(join(target, '.claude/rules/constitution.md'), 'utf8')).toBe('# Constitution\n\nv2\n')
    expect(result.steps).toContainEqual({ op: 'apply', target: '.claude/rules/constitution.md', note: '(overwrite)' })
    expect(loadDownstreamLock(target)?.rules.constitution).not.toBeUndefined()
  })

  test('already in sync reports up to date and leaves the lock unchanged', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    const lockBefore = loadDownstreamLock(target)

    const result = await runUpdate(ctxWith(() => '2026-10-01T00:00:00Z'), { source, target, force: false })

    expect(result.ok).toBe(true)
    expect(result.message).toBe('already up to date')
    expect(loadDownstreamLock(target)?.rules).toEqual(lockBefore?.rules ?? {})
  })
})

describe('runUpdate profile vs. lock.rules SSoT', () => {
  test('profile-new rule is NOT auto-added by update; --add pulls it in', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])

    const plain = await runUpdate(ctxWith(), { source, target, force: false, dryRun: true })
    expect(plain.ok).toBe(true)
    expect(plain.steps?.some((s) => s.op === 'add')).toBe(false)

    const added = await runUpdate(ctxWith(), { source, target, force: false, add: ['extra'] })
    expect(added.ok).toBe(true)
    expect(added.message).toContain('extra: added')
    expect(readFileSync(join(target, '.claude/rules/extra.md'), 'utf8')).toBe('# Extra\n')
    expect(Object.keys(loadDownstreamLock(target)?.rules ?? {})).toContain('extra')
  })

  test('rule dropped from the source profile but still present at source keeps syncing normally, not "removed"', async () => {
    const source = fixtureSource()
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])
    const target = await initTarget(source)

    setProfileRules(source, ['constitution'])

    const result = await runUpdate(ctxWith(), { source, target, force: false })

    // lock.rules is the SSoT: the profile dropping 'extra' has no bearing on
    // an already-installed rule whose underlying asset is still present at
    // the source -- it just stays in sync, no drop step at all.
    expect(result.ok).toBe(true)
    expect(result.message).toBe('already up to date')
    expect(existsSync(join(target, '.claude/rules/extra.md'))).toBe(true)
    expect(loadDownstreamLock(target)?.rules.extra).not.toBeUndefined()

    const statusAfter = await statusReport(ctxWith(), { source, target })
    expect(statusAfter.rows).toContainEqual({ rule: 'extra', state: 'synced' })
  })

  test('rule whose underlying asset vanishes from the source entirely is dropped from the lock, local copy kept (this is the only condition that drops)', async () => {
    const source = fixtureSource()
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])
    const target = await initTarget(source)

    rmSync(join(source, 'rules', 'extra.md'))
    const catalog = JSON.parse(readFileSync(join(source, 'catalog.json'), 'utf8')) as Catalog
    delete catalog.rules.extra
    writeFileSync(join(source, 'catalog.json'), JSON.stringify(catalog, null, 2))
    setProfileRules(source, ['constitution'])

    const result = await runUpdate(ctxWith(), { source, target, force: false })

    expect(result.ok).toBe(true)
    expect(result.message).toContain('extra: removed from source profile')
    expect(result.message).toContain('manual cleanup')
    expect(existsSync(join(target, '.claude/rules/extra.md'))).toBe(true)
    expect(loadDownstreamLock(target)?.rules.extra).toBe(undefined)

    const statusAfter = await statusReport(ctxWith(), { source, target })
    expect(statusAfter.rows.some((r) => r.rule === 'extra')).toBe(false)
  })

  test('update no longer runs composition validation; a bogus profile rule has no bearing on the plan', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(source, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution', 'ghost'] } }))

    const result = await runUpdate(ctxWith(), { source, target, force: false, dryRun: true })

    expect(result.ok).toBe(true)
    expect(result.steps).toContainEqual(expect.objectContaining({ op: 'synced', target: '.claude/rules/constitution.md' }))
  })
})

describe('runUpdate --dry-run', () => {
  test('reports per-rule decisions (apply/skip-modified) without applying, and prints matching plain-text lines', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(source, 'rules', 'constitution.md'), '# Constitution\n\nv2\n')
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])
    const preUpdateResult = await runUpdate(ctxWith(), { source, target, force: false, add: ['extra'] })
    expect(preUpdateResult.ok).toBe(true) // extra gets added, constitution gets updated to v2

    writeFileSync(join(target, '.claude/rules/extra.md'), '# Extra\n\nlocally edited\n')
    writeFileSync(join(source, 'rules', 'constitution.md'), '# Constitution\n\nv3\n')

    const lockBefore = loadDownstreamLock(target)
    const constitutionBefore = readFileSync(join(target, '.claude/rules/constitution.md'), 'utf8')
    const extraBefore = readFileSync(join(target, '.claude/rules/extra.md'), 'utf8')

    const result = await runUpdate(ctxWith(), { source, target, force: false, dryRun: true })

    expect(result.ok).toBe(true)
    const steps = result.steps ?? []
    expect(steps).toContainEqual(expect.objectContaining({ op: 'apply', target: '.claude/rules/constitution.md' }))
    expect(steps).toContainEqual(expect.objectContaining({ op: 'skip-modified', target: '.claude/rules/extra.md' }))

    expect(readFileSync(join(target, '.claude/rules/constitution.md'), 'utf8')).toBe(constitutionBefore)
    expect(readFileSync(join(target, '.claude/rules/extra.md'), 'utf8')).toBe(extraBefore)
    expect(loadDownstreamLock(target)).toEqual(lockBefore)

    const lines = result.message.split('\n')
    expect(lines.some((l) => l.startsWith('apply .claude/rules/constitution.md'))).toBe(true)
    expect(lines.some((l) => l.startsWith('skip-modified .claude/rules/extra.md'))).toBe(true)
  })

  test('reports synced (not a no-op result) when already up to date, and leaves the lock untouched', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    const lockBefore = loadDownstreamLock(target)

    const result = await runUpdate(ctxWith(), { source, target, force: false, dryRun: true })

    expect(result.ok).toBe(true)
    const steps = result.steps ?? []
    expect(steps).toContainEqual(expect.objectContaining({ op: 'synced', target: '.claude/rules/constitution.md' }))
    expect(loadDownstreamLock(target)).toEqual(lockBefore)
  })
})

describe('runUpdate include/exclude semantics', () => {
  function excludeConstitution(target: string): void {
    const initialLock = loadDownstreamLock(target)
    if (initialLock === null) throw new Error('fixture lock missing')
    const { constitution: _c, ...restRules } = initialLock.rules
    saveDownstreamLock(target, { ...initialLock, rules: restRules, excluded: ['constitution'] })
  }

  test('clean re-include (local file absent, or present but identical to source) copies, joins the rules baseline, drops from excluded, fires onProgress include', async () => {
    const absentSource = fixtureSource()
    const absentTarget = await initTarget(absentSource)
    excludeConstitution(absentTarget)
    rmSync(join(absentTarget, '.claude/rules/constitution.md'))

    const seenOps: string[] = []
    const absentResult = await runUpdate(ctxWith(), {
      source: absentSource, target: absentTarget, force: false, add: ['constitution'], onProgress: (s) => seenOps.push(s.op),
    })

    expect(absentResult.ok).toBe(true)
    expect(readFileSync(join(absentTarget, '.claude/rules/constitution.md'), 'utf8')).toBe('# Constitution\n')
    const absentLock = loadDownstreamLock(absentTarget)
    expect(absentLock?.rules.constitution).not.toBeUndefined()
    expect(absentLock?.excluded ?? []).not.toContain('constitution')
    expect(absentResult.steps).toContainEqual({ op: 'include', target: '.claude/rules/constitution.md' })
    expect(seenOps).toContain('include')

    // local file untouched, content identical to source -- still "clean"
    const identicalSource = fixtureSource()
    const identicalTarget = await initTarget(identicalSource)
    excludeConstitution(identicalTarget)

    const identicalResult = await runUpdate(ctxWith(), { source: identicalSource, target: identicalTarget, force: false, add: ['constitution'] })

    expect(identicalResult.ok).toBe(true)
    const identicalLock = loadDownstreamLock(identicalTarget)
    expect(identicalLock?.rules.constitution).not.toBeUndefined()
    expect(identicalLock?.excluded ?? []).toEqual([])
    expect(identicalResult.steps).toContainEqual({ op: 'include', target: '.claude/rules/constitution.md' })
  })

  test('differing local content -> default skip-include with diff hint, excluded stays, fires onProgress skip-include', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    excludeConstitution(target)
    writeFileSync(join(target, '.claude/rules/constitution.md'), '# Constitution\n\nlocal divergent\n')

    const seenOps: string[] = []
    const result = await runUpdate(ctxWith(), { source, target, force: false, add: ['constitution'], onProgress: (s) => seenOps.push(s.op) })

    expect(result.ok).toBe(true)
    expect(readFileSync(join(target, '.claude/rules/constitution.md'), 'utf8')).toBe('# Constitution\n\nlocal divergent\n')
    const lock = loadDownstreamLock(target)
    expect(lock?.rules.constitution).toBeUndefined()
    expect(lock?.excluded ?? []).toContain('constitution')
    expect(result.steps).toContainEqual({
      op: 'skip-include',
      target: '.claude/rules/constitution.md',
      note: "local differs, kept (see 'iuse diff --rule <name>', use --force to overwrite)",
    })
    expect(seenOps).toContain('skip-include')
  })

  test('differing local content is overwritten by global --force, or by rule-scoped --overwrite without --force', async () => {
    const forceSource = fixtureSource()
    const forceTarget = await initTarget(forceSource)
    excludeConstitution(forceTarget)
    writeFileSync(join(forceTarget, '.claude/rules/constitution.md'), '# Constitution\n\nlocal divergent\n')

    const forceResult = await runUpdate(ctxWith(), { source: forceSource, target: forceTarget, force: true, add: ['constitution'] })
    expect(forceResult.ok).toBe(true)
    expect(readFileSync(join(forceTarget, '.claude/rules/constitution.md'), 'utf8')).toBe('# Constitution\n')
    expect(forceResult.steps).toContainEqual({ op: 'include', target: '.claude/rules/constitution.md', note: '(overwrite)' })

    const overwriteSource = fixtureSource()
    const overwriteTarget = await initTarget(overwriteSource)
    excludeConstitution(overwriteTarget)
    writeFileSync(join(overwriteTarget, '.claude/rules/constitution.md'), '# Constitution\n\nlocal divergent\n')

    const overwriteResult = await runUpdate(ctxWith(), {
      source: overwriteSource, target: overwriteTarget, force: false, add: ['constitution'], overwrite: ['constitution'],
    })
    expect(overwriteResult.ok).toBe(true)
    expect(readFileSync(join(overwriteTarget, '.claude/rules/constitution.md'), 'utf8')).toBe('# Constitution\n')
    expect(overwriteResult.steps).toContainEqual({ op: 'include', target: '.claude/rules/constitution.md', note: '(overwrite)' })
  })

  test('excluded rule not named in --add produces zero steps (permanent gate) even as source moves on, status still reports excluded', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    excludeConstitution(target)
    writeFileSync(join(source, 'rules', 'constitution.md'), '# Constitution\n\nv2\n')

    const result = await runUpdate(ctxWith(), { source, target, force: false })

    expect(result.ok).toBe(true)
    expect((result.steps ?? []).some((s) => s.target.includes('constitution'))).toBe(false)
    expect(loadDownstreamLock(target)?.excluded).toEqual(['constitution'])

    const statusAfter = await statusReport(ctxWith(), { source, target })
    expect(statusAfter.rows).toContainEqual({ rule: 'constitution', state: 'excluded' })
  })

  test('exclusion and re-include never delete the local file copy', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    excludeConstitution(target)
    expect(existsSync(join(target, '.claude/rules/constitution.md'))).toBe(true)

    await runUpdate(ctxWith(), { source, target, force: false })
    expect(existsSync(join(target, '.claude/rules/constitution.md'))).toBe(true)

    await runUpdate(ctxWith(), { source, target, force: false, add: ['constitution'] })
    expect(existsSync(join(target, '.claude/rules/constitution.md'))).toBe(true)
  })

  test('--add re-includes an excluded rule (former --include semantics): drops from excluded, joins lock.rules', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    excludeConstitution(target)

    const result = await runUpdate(ctxWith(), { source, target, force: false, add: ['constitution'] })

    expect(result.ok).toBe(true)
    const lock = loadDownstreamLock(target)
    expect(lock?.excluded ?? []).not.toContain('constitution')
    expect(Object.keys(lock?.rules ?? {})).toContain('constitution')
  })
})

describe('runUpdate --add/--remove failure paths', () => {
  test('--add an already-installed non-excluded rule fails with "already installed"', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    const initialLock = loadDownstreamLock(target)
    if (initialLock === null) throw new Error('fixture lock missing')
    saveDownstreamLock(target, { ...initialLock, excluded: ['other-rule'] })

    const result = await runUpdate(ctxWith(), { source, target, force: false, add: ['constitution'] })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('already installed')
    expect(result.message).toContain('constitution')
  })

  test('--add unknown name fails listing it; --remove unknown name (not in lock.rules) fails the same way', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)

    const addResult = await runUpdate(ctxWith(), { source, target, force: false, add: ['nope'] })
    expect(addResult.ok).toBe(false)
    expect(addResult.message).toContain('nope')

    const removeResult = await runUpdate(ctxWith(), { source, target, force: false, remove: ['nope'] })
    expect(removeResult.ok).toBe(false)
    expect(removeResult.message).toContain('nope')
  })

  test('--add a rule with a catalog entry but missing artifact (violation) fails with imeta build hint', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    addRule(source, 'incomplete', '# Incomplete\n')
    rmSync(join(source, 'rules', 'incomplete.md'))

    const result = await runUpdate(ctxWith(), { source, target, force: false, add: ['incomplete'] })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('imeta build')
  })
})

describe('runUpdate --remove', () => {
  test('deletes the copy, drops the lock entry, records exclusion', async () => {
    const source = fixtureSource()
    addRule(source, 'edited', '# Edited\n')
    setProfileRules(source, ['constitution', 'edited'])
    const target = mkdtempSync(join(tmpdir(), 'iuse-update-tgt-'))
    const initResult = await runInit(ctxWith(), { source, profile: 'demo', target, force: false })
    if (!initResult.ok) throw new Error(`fixture init failed: ${initResult.message}`)

    const result = await runUpdate(ctxWith(), { source, target, force: false, remove: ['edited'] })

    expect(result.ok).toBe(true)
    expect(existsSync(join(target, '.claude/rules/edited.md'))).toBe(false)
    const lock = loadDownstreamLock(target)
    expect(Object.keys(lock?.rules ?? {})).not.toContain('edited')
    expect(lock?.excluded ?? []).toContain('edited')
  })
})

describe('runUpdate onProgress', () => {
  test('fires per executed step in order matching result.steps, and never fires during dry-run', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(source, 'rules', 'constitution.md'), '# Constitution\n\nv2\n')
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])

    const seenOps: string[] = []
    const onProgress = (step: { op: string; target: string }) => seenOps.push(step.op)

    const result = await runUpdate(ctxWith(), { source, target, force: false, add: ['extra'], onProgress })

    expect(result.ok).toBe(true)
    const resultOps = (result.steps ?? []).filter((s) => s.op !== 'synced').map((s) => s.op)
    expect(seenOps).toEqual(resultOps)

    const seenOpsDry: string[] = []
    const resultDry = await runUpdate(ctxWith(), { source, target, force: false, dryRun: true, onProgress: (s) => seenOpsDry.push(s.op) })

    expect(resultDry.ok).toBe(true)
    expect(seenOpsDry.length).toBe(0)
  })
})
