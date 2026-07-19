import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { globalStatusReport } from '../src/core/global'
import { runInit } from '../src/core/init'
import type { IuseContext } from '../src/core/init'

/**
 * Recursive full-content snapshot of a directory tree, keyed by path relative
 * to `dir`. Used to assert the read-only invariant: global reconciliation
 * must never touch $HOME, so a before/after snapshot must compare equal.
 */
function snapshotDir(dir: string): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        walk(full)
        continue
      }
      out[relative(dir, full)] = readFileSync(full, 'utf8')
    }
  }
  walk(dir)
  return out
}

/**
 * A source fixture carrying globals.json { rules: ["alpha","beta"] } plus
 * ready meta + built artifacts for both -- mirrors tests/list.test.ts's
 * fixtureSource but scoped to what global reconciliation needs (no catalog.json).
 */
function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-global-src-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  mkdirSync(join(dir, 'rules', 'global'), { recursive: true })
  mkdirSync(join(dir, 'templates'), { recursive: true })

  writeFileSync(join(dir, 'meta', 'tags.json'), JSON.stringify({ concern: { exclusive: false, values: { core: 'x' } } }))
  writeFileSync(
    join(dir, 'meta', 'rules', 'alpha.md'),
    '---\nname: alpha\nstatus: ready\ndescription: x\nscope: global\ntags: [core]\n---\nbody',
  )
  writeFileSync(
    join(dir, 'meta', 'rules', 'beta.md'),
    '---\nname: beta\nstatus: ready\ndescription: x\nscope: global\ntags: [core]\n---\nbody',
  )
  writeFileSync(
    join(dir, 'meta', 'rules', 'constitution.md'),
    '---\nname: constitution\nstatus: ready\ndescription: x\nscope: global\ntags: [core]\n---\nbody',
  )
  writeFileSync(join(dir, 'rules', 'global', 'alpha.md'), '# Alpha\n\nbody\n')
  writeFileSync(join(dir, 'rules', 'global', 'beta.md'), '# Beta\n\nbody\n')
  writeFileSync(join(dir, 'rules', 'global', 'constitution.md'), '# Constitution\n')
  writeFileSync(join(dir, 'globals.json'), JSON.stringify({ rules: ['alpha', 'beta'] }))
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { rules: ['alpha', 'constitution'] } }))
  writeFileSync(join(dir, 'templates', 'settings.json'), JSON.stringify({ model: 'sonnet' }))
  writeFileSync(join(dir, 'templates', 'architecture.md'), '# [PROJECT_NAME] - Architecture\n\nbody\n')
  writeFileSync(join(dir, 'templates', 'claude-md.md'), '# [PROJECT_NAME]\n\nbody\n')
  mkdirSync(join(dir, 'meta', 'prompts'), { recursive: true })
  writeFileSync(join(dir, 'meta', 'prompts', 'template-instantiate.md'), '# contract\n')
  return dir
}

function bareSourceFixture(): string {
  // A valid infra-ai source (has profiles.json) but no globals.json declared.
  const dir = mkdtempSync(join(tmpdir(), 'iuse-global-bare-src-'))
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({}))
  return dir
}

/**
 * fakeHome carrying `.claude/rules/`: alpha.md matching the source, beta.md
 * absent, plus an undeclared stray.md -- covers synced/missing/unmanaged.
 */
function fakeHomeFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-global-home-'))
  mkdirSync(join(dir, '.claude', 'rules'), { recursive: true })
  writeFileSync(join(dir, '.claude', 'rules', 'alpha.md'), '# Alpha\n\nbody\n')
  writeFileSync(join(dir, '.claude', 'rules', 'stray.md'), '# Stray\n')
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
    cacheDir: '/tmp/iuse-global-cache',
    ...overrides,
  }
}

describe('globalStatusReport', () => {
  test('global status: synced/differs/missing/unmanaged with suggestions, read-only', async () => {
    const source = fixtureSource()
    const fakeHome = fakeHomeFixture()
    const before = snapshotDir(fakeHome)

    const result = await globalStatusReport(fakeCtx({ home: fakeHome }), { source })

    expect(result.ok).toBe(true)
    const byRule = new Map(result.rows.map((r) => [r.rule, r]))
    expect(byRule.get('alpha')?.state).toBe('synced')
    expect(byRule.get('beta')?.state).toBe('missing')
    expect(byRule.get('beta')?.suggestion).toContain('cp ')
    expect(byRule.get('beta')?.suggestion).toContain('.claude/rules/beta.md')
    expect(byRule.get('stray')?.state).toBe('unmanaged')
    expect(result.exitCode).toBe(1) // missing present

    expect(snapshotDir(fakeHome)).toEqual(before)
  })

  test('global status: differs carries diff hint; all-synced exits 0', async () => {
    const source = fixtureSource()
    const fakeHome = fakeHomeFixture()
    writeFileSync(join(fakeHome, '.claude', 'rules', 'alpha.md'), '# Alpha\n\nlocally edited\n')
    // Make beta present too so this fixture is only exercising differs, not missing.
    writeFileSync(join(fakeHome, '.claude', 'rules', 'beta.md'), '# Beta\n\nbody\n')

    const result = await globalStatusReport(fakeCtx({ home: fakeHome }), { source })

    expect(result.ok).toBe(true)
    const byRule = new Map(result.rows.map((r) => [r.rule, r]))
    expect(byRule.get('alpha')?.state).toBe('differs')
    expect(byRule.get('alpha')?.suggestion).toContain('iuse diff --global --rule alpha')
    expect(result.exitCode).toBe(1)

    // A second, fully-consistent fixture: every declared rule synced, no stray files -> exit 0.
    const allSyncedHome = mkdtempSync(join(tmpdir(), 'iuse-global-home-synced-'))
    mkdirSync(join(allSyncedHome, '.claude', 'rules'), { recursive: true })
    writeFileSync(join(allSyncedHome, '.claude', 'rules', 'alpha.md'), '# Alpha\n\nbody\n')
    writeFileSync(join(allSyncedHome, '.claude', 'rules', 'beta.md'), '# Beta\n\nbody\n')

    const synced = await globalStatusReport(fakeCtx({ home: allSyncedHome }), { source })

    expect(synced.ok).toBe(true)
    const syncedByRule = new Map(synced.rows.map((r) => [r.rule, r.state]))
    expect(syncedByRule.get('alpha')).toBe('synced')
    expect(syncedByRule.get('beta')).toBe('synced')
    expect(synced.exitCode).toBe(0)
  })

  test('globals.json missing at source fails with establishment hint', async () => {
    const bareSource = bareSourceFixture()
    const fakeHome = fakeHomeFixture()

    const result = await globalStatusReport(fakeCtx({ home: fakeHome }), { source: bareSource })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('globals.json')
  })

  test('globals.json declares a rule absent from the source fails fast', async () => {
    const source = fixtureSource()
    writeFileSync(join(source, 'globals.json'), JSON.stringify({ rules: ['alpha', 'ghost'] }))
    const fakeHome = fakeHomeFixture()

    const result = await globalStatusReport(fakeCtx({ home: fakeHome }), { source })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('ghost')
    expect(result.message).toContain('globals.json')
    expect(result.rows).toEqual([])
    expect(result.exitCode).toBe(1)
  })

  test('duplicate: rule in project lock and global file both present', async () => {
    const source = fixtureSource()
    const fakeHome = fakeHomeFixture()
    // alpha.md already present in fakeHome/.claude/rules from fakeHomeFixture; init a project
    // target seeded with the 'demo' profile, which includes 'alpha'.
    const target = mkdtempSync(join(tmpdir(), 'iuse-global-tgt-'))
    const initResult = await runInit(fakeCtx({ home: fakeHome }), { source, profile: 'demo', target, force: false })
    if (!initResult.ok) throw new Error(`fixture init failed: ${initResult.message}`)

    const result = await globalStatusReport(fakeCtx({ home: fakeHome }), { source, projectTarget: target })

    expect(result.duplicates).toEqual(['alpha'])
  })

  test('duplicates do not affect exitCode when the rest is fully synced', async () => {
    const source = fixtureSource()
    const allSyncedHome = mkdtempSync(join(tmpdir(), 'iuse-global-home-dup-'))
    mkdirSync(join(allSyncedHome, '.claude', 'rules'), { recursive: true })
    writeFileSync(join(allSyncedHome, '.claude', 'rules', 'alpha.md'), '# Alpha\n\nbody\n')
    writeFileSync(join(allSyncedHome, '.claude', 'rules', 'beta.md'), '# Beta\n\nbody\n')
    const target = mkdtempSync(join(tmpdir(), 'iuse-global-tgt-'))
    const initResult = await runInit(fakeCtx({ home: allSyncedHome }), { source, profile: 'demo', target, force: false })
    if (!initResult.ok) throw new Error(`fixture init failed: ${initResult.message}`)

    const result = await globalStatusReport(fakeCtx({ home: allSyncedHome }), { source, projectTarget: target })

    expect(result.duplicates).toEqual(['alpha'])
    expect(result.exitCode).toBe(0)
  })
})
