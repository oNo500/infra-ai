import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Catalog } from '../src/core/contract'
import { listReport } from '../src/core/list'
import { runInit } from '../src/core/init'
import type { IuseContext } from '../src/core/init'
import { loadDownstreamLock, saveDownstreamLock } from '../src/core/manifest'

/**
 * Adds a third catalog rule 'gamma' to an existing fixtureSource(), plus its
 * built artifact -- used only by the global-list test so the base fixture
 * (and every test asserting rows === ['alpha','beta']) stays untouched.
 */
function addGammaRule(source: string): void {
  writeFileSync(join(source, 'rules', 'gamma.md'), '# Gamma\n\nbody\n')
  const catalog = JSON.parse(readFileSync(join(source, 'catalog.json'), 'utf8')) as Catalog
  catalog.rules.gamma = { description: 'gamma description', tags: ['extra'], requires: [], scope: 'global', path: 'rules/gamma.md', profiles: [] }
  writeFileSync(join(source, 'catalog.json'), JSON.stringify(catalog, null, 2))
}

/**
 * A catalog-bearing source fixture: catalog.json is handwritten (not derived
 * via buildCatalog) so the fixture stays independent of meta-cli's builder,
 * plus profiles.json/templates so runInit can initialize a target from it.
 */
function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-list-src-'))
  mkdirSync(join(dir, 'rules'), { recursive: true })
  mkdirSync(join(dir, 'templates'), { recursive: true })

  // 'constitution' is a real built artifact (profile-based runInit needs it
  // on disk) but deliberately absent from catalog.rules -- every list-row
  // assertion in this file expects exactly ['alpha', 'beta'], so tests that
  // need profile 'demo' to pass catalog-driven composition validation add a
  // catalog entry for it themselves via addConstitutionToCatalog().
  writeFileSync(join(dir, 'rules', 'constitution.md'), '# Constitution\n')

  const catalog: Catalog = {
    generatedAt: '2026-07-18T00:00:00Z',
    tags: { concern: { exclusive: false, values: { core: 'core concern', extra: 'extra concern' } } },
    rules: {
      alpha: {
        description: '甲说明',
        tags: ['core'],
        requires: [],
        scope: 'global',
        path: 'rules/alpha.md',
        profiles: ['demo'],
      },
      beta: {
        description: 'beta description',
        tags: ['extra'],
        requires: [],
        scope: 'global',
        path: 'rules/beta.md',
        profiles: [],
      },
    },
  }
  writeFileSync(join(dir, 'catalog.json'), JSON.stringify(catalog, null, 2))
  writeFileSync(join(dir, 'rules', 'alpha.md'), '# Alpha\n\nbody\n')
  writeFileSync(join(dir, 'rules', 'beta.md'), '# Beta\n\nbody\n')
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { description: 'Demo', rules: ['alpha', 'constitution'] } }))
  writeFileSync(join(dir, 'templates', 'settings.json'), JSON.stringify({ model: 'sonnet' }))
  writeFileSync(join(dir, 'templates', 'architecture.md'), '# [PROJECT_NAME] - Architecture\n\nbody\n')
  writeFileSync(join(dir, 'templates', 'claude-md.md'), '# [PROJECT_NAME]\n\nbody\n')
  writeFileSync(join(dir, 'templates', 'template-instantiate.md'), '# contract\n')
  return dir
}

/**
 * Adds a scoped catalog rule 'sigma' (plain-body artifact, scope glob in
 * catalog only) -- exercises the render-aware install-state comparison:
 * the installed copy carries rendered paths frontmatter, the source artifact
 * does not.
 */
function addSigmaRule(source: string): void {
  writeFileSync(join(source, 'rules', 'sigma.md'), '# Sigma\n')
  const catalog = JSON.parse(readFileSync(join(source, 'catalog.json'), 'utf8')) as Catalog
  catalog.rules.sigma = { description: 'scoped rule', tags: ['extra'], requires: [], scope: '**/*.md', path: 'rules/sigma.md', profiles: [] }
  writeFileSync(join(source, 'catalog.json'), JSON.stringify(catalog, null, 2))
}

/**
 * 'constitution' has a built artifact but is deliberately absent from the
 * base fixture's catalog (see fixtureSource's comment). Tests that init from
 * profile 'demo' need it present so catalog-driven composition validation
 * (planAssembly's "profile missing constitution" check) passes.
 */
function addConstitutionToCatalog(source: string): void {
  const catalog = JSON.parse(readFileSync(join(source, 'catalog.json'), 'utf8')) as Catalog
  catalog.rules.constitution = { description: 'x', tags: ['core'], requires: [], scope: 'global', path: 'rules/constitution.md', profiles: ['demo'] }
  writeFileSync(join(source, 'catalog.json'), JSON.stringify(catalog, null, 2))
}

function bareSourceFixture(): string {
  // A valid infra-ai source (has profiles.json) but never ran `imeta catalog`.
  const dir = mkdtempSync(join(tmpdir(), 'iuse-list-bare-src-'))
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({}))
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

function fakeCtx(overrides: Partial<IuseContext> = {}): IuseContext {
  return {
    download: async () => ({}),
    run: async () => ({ code: 0, stdout: 'head1\n', stderr: '' }),
    claude: fakeClaudeWriting(),
    now: () => '2026-07-18T00:00:00Z',
    env: {},
    home: '/nope',
    cacheDir: '/tmp/iuse-list-cache',
    ...overrides,
  }
}

async function initializedTargetWith(source: string): Promise<string> {
  const target = mkdtempSync(join(tmpdir(), 'iuse-list-tgt-'))
  const result = await runInit(fakeCtx(), { source, rules: ['alpha'], profile: '-', target, force: false })
  if (!result.ok) throw new Error(`fixture init failed: ${result.message}`)
  return target
}

describe('listReport', () => {
  test('list surfaces catalog rows; --tag intersects; --grep matches name/description/content', async () => {
    const source = fixtureSource()
    const uninitTarget = mkdtempSync(join(tmpdir(), 'iuse-list-uninit-'))

    const all = await listReport(fakeCtx(), { source, target: uninitTarget })
    expect(all.ok).toBe(true)
    expect(all.rows.map((r) => r.name)).toEqual(['alpha', 'beta'])
    expect(all.rows[0]?.state).toBeUndefined()
    expect(all.exitCode).toBe(0)

    const tagged = await listReport(fakeCtx(), { source, target: uninitTarget, tags: ['core'] })
    expect(tagged.rows.map((r) => r.name)).toEqual(['alpha'])

    const grepped = await listReport(fakeCtx(), { source, target: uninitTarget, grep: '甲' })
    expect(grepped.rows.map((r) => r.name)).toEqual(['alpha'])
  })

  test('--tag with multiple values requires intersection (rule must carry all named tags)', async () => {
    const source = fixtureSource()
    const uninitTarget = mkdtempSync(join(tmpdir(), 'iuse-list-uninit-'))

    const result = await listReport(fakeCtx(), { source, target: uninitTarget, tags: ['core', 'extra'] })

    expect(result.rows).toEqual([])
  })

  test('--grep matches on artifact content as well as name/description, case-insensitively', async () => {
    const source = fixtureSource()
    const uninitTarget = mkdtempSync(join(tmpdir(), 'iuse-list-uninit-'))

    const byName = await listReport(fakeCtx(), { source, target: uninitTarget, grep: 'Beta' })
    expect(byName.rows.map((r) => r.name)).toEqual(['beta'])

    // 'aLpHa' (mixed case) matches artifact content '# Alpha' (mixed differently).
    const byContent = await listReport(fakeCtx(), { source, target: uninitTarget, grep: 'aLpHa' })
    expect(byContent.rows.map((r) => r.name)).toEqual(['alpha'])
  })

  test('initialized target annotates install states incl. uninstalled and excluded', async () => {
    const source = fixtureSource()
    const initializedTarget = await initializedTargetWith(source)
    const lock = loadDownstreamLock(initializedTarget)
    if (lock === null) throw new Error('fixture lock missing')
    saveDownstreamLock(initializedTarget, { ...lock, excluded: ['beta'] })

    const result = await listReport(fakeCtx(), { source, target: initializedTarget })

    expect(result.ok).toBe(true)
    const byName = new Map(result.rows.map((r) => [r.name, r.state]))
    expect(byName.get('alpha')).toBe('synced')
    expect(byName.get('beta')).toBe('excluded')
  })

  test('profile-seeded rule not yet installed nor excluded annotates available', async () => {
    const source = fixtureSource()
    addConstitutionToCatalog(source)
    const target = mkdtempSync(join(tmpdir(), 'iuse-list-avail-tgt-'))
    const initResult = await runInit(fakeCtx(), { source, profile: 'demo', target, force: false })
    if (!initResult.ok) throw new Error(`fixture init failed: ${initResult.message}`)
    // Grow the profile after init so 'beta' becomes an available seed.
    writeFileSync(
      join(source, 'profiles.json'),
      JSON.stringify({ demo: { description: 'Demo', rules: ['alpha', 'beta', 'constitution'] } }),
    )

    const result = await listReport(fakeCtx(), { source, target })

    const byName = new Map(result.rows.map((r) => [r.name, r.state]))
    expect(byName.get('alpha')).toBe('synced')
    expect(byName.get('beta')).toBe('available')
  })

  test('catalog entry outside the seed profile and not locked annotates uninstalled', async () => {
    const source = fixtureSource()
    const initializedTarget = await initializedTargetWith(source)

    const result = await listReport(fakeCtx(), { source, target: initializedTarget })

    const byName = new Map(result.rows.map((r) => [r.name, r.state]))
    expect(byName.get('beta')).toBe('uninstalled')
  })

  test('catalog entry whose artifact file is missing on the source annotates broken without aborting the list', async () => {
    const source = fixtureSource()
    rmSync(join(source, 'rules', 'beta.md'))
    const uninitTarget = mkdtempSync(join(tmpdir(), 'iuse-list-uninit-'))

    const result = await listReport(fakeCtx(), { source, target: uninitTarget })

    expect(result.ok).toBe(true)
    const byName = new Map(result.rows.map((r) => [r.name, r.state]))
    expect(byName.get('beta')).toBe('broken')
    expect(result.rows.map((r) => r.name)).toEqual(['alpha', 'beta'])
  })

  test('missing catalog and source resolution failure both fail cleanly with empty rows, exitCode 1', async () => {
    const uninitTarget = mkdtempSync(join(tmpdir(), 'iuse-list-uninit-'))

    const missingCatalog = await listReport(fakeCtx(), { source: bareSourceFixture(), target: uninitTarget })
    expect(missingCatalog.ok).toBe(false)
    expect(missingCatalog.message).toContain('imeta catalog')
    expect(missingCatalog.rows).toEqual([])
    expect(missingCatalog.exitCode).toBe(1)

    const badSource = mkdtempSync(join(tmpdir(), 'iuse-list-badsrc-'))
    const badSourceResult = await listReport(fakeCtx(), { source: badSource, target: uninitTarget })
    expect(badSourceResult.ok).toBe(false)
    expect(badSourceResult.message).toContain('profiles.json not found')
    expect(badSourceResult.rows).toEqual([])
    expect(badSourceResult.exitCode).toBe(1)
  })

  test('dev-repo artifacts/ layout source (no catalog.json at root) is detected and rows/content resolve from artifacts/', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'iuse-list-devsrc-'))
    mkdirSync(join(dir, 'artifacts', 'rules'), { recursive: true })
    writeFileSync(join(dir, 'artifacts', 'rules', 'alpha.md'), '# Alpha\n\nbody\n')
    const catalog: Catalog = {
      generatedAt: '2026-07-19T00:00:00Z',
      tags: {},
      rules: {
        alpha: { description: '甲说明', tags: ['core'], requires: [], scope: 'global', path: 'rules/alpha.md', profiles: [] },
      },
    }
    writeFileSync(join(dir, 'artifacts', 'catalog.json'), JSON.stringify(catalog, null, 2))
    writeFileSync(join(dir, 'profiles.json'), JSON.stringify({}))
    const uninitTarget = mkdtempSync(join(tmpdir(), 'iuse-list-devsrc-tgt-'))

    const result = await listReport(fakeCtx(), { source: dir, target: uninitTarget })

    expect(result.ok).toBe(true)
    expect(result.rows.map((r) => r.name)).toEqual(['alpha'])
    const grepped = await listReport(fakeCtx(), { source: dir, target: uninitTarget, grep: 'body' })
    expect(grepped.rows.map((r) => r.name)).toEqual(['alpha'])
  })

  test('global list: declared synced/differs/missing, undeclared uninstalled', async () => {
    const source = fixtureSource()
    addGammaRule(source)
    writeFileSync(join(source, 'globals.json'), JSON.stringify({ rules: ['alpha', 'beta'] }))
    const fakeHome = mkdtempSync(join(tmpdir(), 'iuse-list-home-'))
    mkdirSync(join(fakeHome, '.claude', 'rules'), { recursive: true })
    writeFileSync(join(fakeHome, '.claude', 'rules', 'alpha.md'), '# Alpha\n\nbody\n')

    const result = await listReport(fakeCtx({ home: fakeHome }), { target: fakeHome, source, global: true })

    const state = (n: string): string | undefined => result.rows.find((r) => r.name === n)?.state
    expect(state('alpha')).toBe('synced')
    expect(state('beta')).toBe('missing')
    expect(state('gamma')).toBe('uninstalled')
  })

  test('scoped rule installed via init reports synced (render-aware comparison)', async () => {
    const source = fixtureSource()
    addSigmaRule(source)
    const target = mkdtempSync(join(tmpdir(), 'iuse-list-tgt-'))
    const init = await runInit(fakeCtx(), { source, rules: ['sigma'], profile: '-', target, force: false })
    if (!init.ok) throw new Error(`fixture init failed: ${init.message}`)

    const result = await listReport(fakeCtx(), { source, target })

    const sigma = result.rows.find((r) => r.name === 'sigma')
    expect(sigma?.state).toBe('synced')
  })

  test('globals.json declares a rule absent from the source fails fast', async () => {
    const source = fixtureSource()
    writeFileSync(join(source, 'globals.json'), JSON.stringify({ rules: ['alpha', 'ghost'] }))
    const fakeHome = mkdtempSync(join(tmpdir(), 'iuse-list-home-'))
    mkdirSync(join(fakeHome, '.claude', 'rules'), { recursive: true })

    const result = await listReport(fakeCtx({ home: fakeHome }), { target: fakeHome, source, global: true })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('ghost')
    expect(result.message).toContain('globals.json')
    expect(result.rows).toEqual([])
    expect(result.exitCode).toBe(1)
  })
})
