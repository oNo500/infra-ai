import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Catalog } from '@infra-ai/meta-cli/core'
import { listReport } from '../src/core/list'
import { runInit } from '../src/core/init'
import type { IuseContext } from '../src/core/init'
import { loadDownstreamLock, saveDownstreamLock } from '../src/core/manifest'

/**
 * A catalog-bearing source fixture: catalog.json is handwritten (not derived
 * via buildCatalog) so the fixture stays independent of meta-cli's builder,
 * plus profiles.json/templates so runInit can initialize a target from it.
 */
function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-list-src-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  mkdirSync(join(dir, 'rules', 'global'), { recursive: true })
  mkdirSync(join(dir, 'templates'), { recursive: true })

  writeFileSync(join(dir, 'meta', 'tags.json'), JSON.stringify({ concern: { exclusive: false, values: { core: 'x', extra: 'x' } } }))
  writeFileSync(
    join(dir, 'meta', 'rules', 'alpha.md'),
    '---\nname: alpha\nstatus: ready\ndescription: 甲说明\nscope: global\ntags: [core]\n---\nbody',
  )
  writeFileSync(
    join(dir, 'meta', 'rules', 'beta.md'),
    '---\nname: beta\nstatus: ready\ndescription: beta description\nscope: global\ntags: [extra]\n---\nbody',
  )
  // validateComposition requires every profile to include a rule named
  // 'constitution' -- irrelevant to list/show semantics, so it is kept out
  // of the catalog and only exists to let profile-based runInit succeed.
  writeFileSync(
    join(dir, 'meta', 'rules', 'constitution.md'),
    '---\nname: constitution\nstatus: ready\ndescription: x\nscope: global\ntags: [core]\n---\nbody',
  )
  writeFileSync(join(dir, 'rules', 'global', 'constitution.md'), '# Constitution\n')

  const catalog: Catalog = {
    generatedAt: '2026-07-18T00:00:00Z',
    tags: { concern: { exclusive: false, values: { core: 'core concern', extra: 'extra concern' } } },
    rules: {
      alpha: {
        description: '甲说明',
        tags: ['core'],
        scope: 'global',
        path: 'rules/global/alpha.md',
        profiles: ['demo'],
      },
      beta: {
        description: 'beta description',
        tags: ['extra'],
        scope: 'global',
        path: 'rules/global/beta.md',
        profiles: [],
      },
    },
  }
  writeFileSync(join(dir, 'catalog.json'), JSON.stringify(catalog, null, 2))
  writeFileSync(join(dir, 'rules', 'global', 'alpha.md'), '# Alpha\n\nbody\n')
  writeFileSync(join(dir, 'rules', 'global', 'beta.md'), '# Beta\n\nbody\n')
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { description: 'Demo', rules: ['alpha', 'constitution'] } }))
  writeFileSync(join(dir, 'templates', 'settings.json'), JSON.stringify({ model: 'sonnet' }))
  writeFileSync(join(dir, 'templates', 'architecture.md'), '# [PROJECT_NAME] - Architecture\n\nbody\n')
  writeFileSync(join(dir, 'templates', 'claude-md.md'), '# [PROJECT_NAME]\n\nbody\n')
  mkdirSync(join(dir, 'meta', 'prompts'), { recursive: true })
  writeFileSync(join(dir, 'meta', 'prompts', 'template-instantiate.md'), '# contract\n')
  return dir
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

function fakeCtx(): IuseContext {
  return {
    download: async () => ({}),
    run: async () => ({ code: 0, stdout: 'head1\n', stderr: '' }),
    claude: fakeClaudeWriting(),
    now: () => '2026-07-18T00:00:00Z',
    env: {},
    home: '/nope',
    cacheDir: '/tmp/iuse-list-cache',
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

  test('--grep matches on artifact content as well as name/description', async () => {
    const source = fixtureSource()
    const uninitTarget = mkdtempSync(join(tmpdir(), 'iuse-list-uninit-'))

    const result = await listReport(fakeCtx(), { source, target: uninitTarget, grep: 'Beta' })

    expect(result.rows.map((r) => r.name)).toEqual(['beta'])
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
    rmSync(join(source, 'rules', 'global', 'beta.md'))
    const uninitTarget = mkdtempSync(join(tmpdir(), 'iuse-list-uninit-'))

    const result = await listReport(fakeCtx(), { source, target: uninitTarget })

    expect(result.ok).toBe(true)
    const byName = new Map(result.rows.map((r) => [r.name, r.state]))
    expect(byName.get('beta')).toBe('broken')
    expect(result.rows.map((r) => r.name)).toEqual(['alpha', 'beta'])
  })

  test('missing catalog fails with imeta catalog hint', async () => {
    const bareSource = bareSourceFixture()
    const uninitTarget = mkdtempSync(join(tmpdir(), 'iuse-list-uninit-'))

    const result = await listReport(fakeCtx(), { source: bareSource, target: uninitTarget })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('imeta catalog')
    expect(result.rows).toEqual([])
    expect(result.exitCode).toBe(1)
  })

  test('source resolution failure fails cleanly with exitCode 1', async () => {
    const badSource = mkdtempSync(join(tmpdir(), 'iuse-list-badsrc-'))
    const uninitTarget = mkdtempSync(join(tmpdir(), 'iuse-list-uninit-'))

    const result = await listReport(fakeCtx(), { source: badSource, target: uninitTarget })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('profiles.json not found')
    expect(result.rows).toEqual([])
    expect(result.exitCode).toBe(1)
  })
})
