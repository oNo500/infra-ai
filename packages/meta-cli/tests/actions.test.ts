import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getAction, type ActionContext, type StatusRowData } from '../src/core/actions'
import { sha256 } from '../src/core/io'

export function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
  writeFileSync(join(root, 'skills.json'), '[]\n')
  mkdirSync(join(root, 'meta/rules'), { recursive: true })
  writeFileSync(
    join(root, 'meta/rules/foo.md'),
    '---\nname: foo\ntarget: rule\nstatus: ready\nscope: global\n---\nbody\n',
  )
  return root
}

export function testContext(root: string, overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    repoRoot: root,
    run: async () => ({ code: 0, stdout: '', stderr: '' }),
    now: () => '2026-07-11T00:00:00.000Z',
    claude: async () => ({ code: 0, timedOut: false, stderr: '' }),
    download: async () => ({}),
    ...overrides,
  }
}

export function syncLock(root: string): void {
  const meta = '---\nname: foo\ntarget: rule\nstatus: ready\nscope: global\n---\nbody\n'
  const artifact = '# foo\n'
  mkdirSync(join(root, 'rules/global'), { recursive: true })
  writeFileSync(join(root, 'rules/global/foo.md'), artifact)
  writeFileSync(
    join(root, 'artifacts.lock.json'),
    `${JSON.stringify({ 'rule:foo': { metaHash: sha256(meta), artifactHash: sha256(artifact), builtAt: '2026-07-11T00:00:00.000Z' } })}\n`,
  )
}

describe('status action', () => {
  test('unbuilt asset yields exitCode 1 with row data', async () => {
    const root = fixtureRepo()
    try {
      const result = await getAction('status').execute(testContext(root), { positionals: [], flags: {} })
      expect(result.ok).toBe(true)
      expect(result.exitCode).toBe(1)
      const rows = result.data as StatusRowData[]
      expect(rows[0]?.name).toBe('foo')
      expect(rows[0]?.status).toBe('unbuilt')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('all synced yields exitCode 0; named lookup filters; unknown name fails', async () => {
    const root = fixtureRepo()
    try {
      syncLock(root)
      const all = await getAction('status').execute(testContext(root), { positionals: [], flags: {} })
      expect(all.exitCode).toBe(0)
      const one = await getAction('status').execute(testContext(root), { positionals: ['foo'], flags: {} })
      expect((one.data as StatusRowData[]).length).toBe(1)
      const missing = await getAction('status').execute(testContext(root), { positionals: ['nope'], flags: {} })
      expect(missing.ok).toBe(false)
      expect(missing.exitCode).toBe(1)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('targets:list action', () => {
  test('returns targets registry data', async () => {
    const root = fixtureRepo()
    try {
      writeFileSync(join(root, 'targets.json'), `${JSON.stringify([{ path: '/tmp/a', subscriptions: ['foo'] }])}\n`)
      const result = await getAction('targets:list').execute(testContext(root), { positionals: [], flags: {} })
      expect(result.ok).toBe(true)
      expect(result.data).toEqual([{ path: '/tmp/a', subscriptions: ['foo'] }])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('skills:status action', () => {
  test('aggregates ledger, mirrors, installed, recommendations', async () => {
    const root = fixtureRepo()
    try {
      writeFileSync(
        join(root, 'skills.json'),
        `${JSON.stringify([
          { name: 'm', source: 'mirror', repo: 'r/x', path: 'p', commit: 'old' },
          { name: 'o', source: 'official', repo: 'own/rep' },
        ])}\n`,
      )
      const run: ActionContext['run'] = async (cmd) =>
        cmd === 'gh' ? { code: 0, stdout: 'new\n', stderr: '' } : { code: 0, stdout: 'skill-a\nskill-b\n', stderr: '' }
      const result = await getAction('skills:status').execute(testContext(root, { run }), { positionals: [], flags: {} })
      expect(result.exitCode).toBe(1)
      const data = result.data as { mirrors: { outdated: boolean }[]; installed: string[]; recommendations: { name: string }[] }
      expect(data.mirrors[0]?.outdated).toBe(true)
      expect(data.installed).toEqual(['skill-a', 'skill-b'])
      expect(data.recommendations[0]?.name).toBe('o')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('adopt action', () => {
  test('records lock baseline for untracked asset; rejects non-untracked', async () => {
    const root = fixtureRepo()
    try {
      mkdirSync(join(root, 'rules/global'), { recursive: true })
      writeFileSync(join(root, 'rules/global/foo.md'), '# foo\n')
      const ok = await getAction('adopt').execute(testContext(root), { positionals: ['foo'], flags: {} })
      expect(ok.ok).toBe(true)
      const lock = JSON.parse(readFileSync(join(root, 'artifacts.lock.json'), 'utf8')) as Record<string, unknown>
      expect(lock['rule:foo']).toBeDefined()
      const again = await getAction('adopt').execute(testContext(root), { positionals: ['foo'], flags: {} })
      expect(again.ok).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('build action', () => {
  test('claude success path verifies artifact and records lock', async () => {
    const root = fixtureRepo()
    try {
      const claude: ActionContext['claude'] = async (opts) => {
        mkdirSync(join(root, 'rules/global'), { recursive: true })
        writeFileSync(join(root, 'rules/global/foo.md'), '# built\n')
        opts.onText?.('building')
        return { code: 0, timedOut: false, stderr: '' }
      }
      const texts: string[] = []
      const result = await getAction('build').execute(
        testContext(root, { claude }),
        { positionals: ['foo'], flags: {} },
        { onText: (t) => texts.push(t) },
      )
      expect(result.ok).toBe(true)
      const lock = JSON.parse(readFileSync(join(root, 'artifacts.lock.json'), 'utf8')) as Record<string, unknown>
      expect(lock['rule:foo']).toBeDefined()
      expect(texts).toContain('building')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('claude failure leaves lock untouched; stub and unknown assets rejected', async () => {
    const root = fixtureRepo()
    try {
      writeFileSync(join(root, 'meta/rules/bar.md'), '---\nname: bar\ntarget: rule\nstatus: stub\n---\n')
      const claude: ActionContext['claude'] = async () => ({ code: 1, timedOut: false, stderr: 'boom' })
      const failRes = await getAction('build').execute(testContext(root, { claude }), { positionals: ['foo'], flags: {} })
      expect(failRes.ok).toBe(false)
      expect(existsSync(join(root, 'artifacts.lock.json'))).toBe(false)
      const stub = await getAction('build').execute(testContext(root), { positionals: ['bar'], flags: {} })
      expect(stub.ok).toBe(false)
      expect(stub.message).toMatch(/stub/u)
      const unknown = await getAction('build').execute(testContext(root), { positionals: ['nope'], flags: {} })
      expect(unknown.ok).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('batch failure message lists already-built assets', async () => {
    const root = fixtureRepo()
    try {
      writeFileSync(
        join(root, 'meta/rules/baz.md'),
        '---\nname: baz\ntarget: rule\nstatus: ready\nscope: global\n---\nbody\n',
      )
      const claude: ActionContext['claude'] = async (opts) => {
        if (opts.prompt.includes('foo')) {
          mkdirSync(join(root, 'rules/global'), { recursive: true })
          writeFileSync(join(root, 'rules/global/foo.md'), '# built\n')
          return { code: 0, timedOut: false, stderr: '' }
        }
        return { code: 1, timedOut: false, stderr: 'boom' }
      }
      const result = await getAction('build').execute(testContext(root, { claude }), {
        positionals: ['foo', 'baz'],
        flags: {},
      })
      expect(result.ok).toBe(false)
      expect(result.message).toContain('baz:')
      expect(result.message).toContain('already built: foo')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('--stale with nothing stale is a no-op success', async () => {
    const root = fixtureRepo()
    try {
      const result = await getAction('build').execute(testContext(root), { positionals: [], flags: { stale: true } })
      expect(result.ok).toBe(true)
      expect(result.message).toBe('no stale assets')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('writeback action', () => {
  test('requires dirty status', async () => {
    const root = fixtureRepo()
    try {
      syncLock(root)
      const notDirty = await getAction('writeback').execute(testContext(root), { positionals: ['foo'], flags: {} })
      expect(notDirty.ok).toBe(false)
      expect(notDirty.message).toMatch(/not dirty/u)
      writeFileSync(join(root, 'rules/global/foo.md'), '# edited\n')
      const claude: ActionContext['claude'] = async () => ({ code: 0, timedOut: false, stderr: '' })
      const dirty = await getAction('writeback').execute(testContext(root, { claude }), { positionals: ['foo'], flags: {} })
      expect(dirty.ok).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('dist action', () => {
  test('copies to subscribers; rejects no-subscriber and non-rule; --all skips synced', async () => {
    const root = fixtureRepo()
    const downstream = mkdtempSync(join(tmpdir(), 'meta-cli-target-'))
    try {
      syncLock(root)
      const none = await getAction('dist').execute(testContext(root), { positionals: ['foo'], flags: {} })
      expect(none.ok).toBe(false)
      expect(none.message).toMatch(/no subscribers/u)
      writeFileSync(
        join(root, 'targets.json'),
        `${JSON.stringify([{ path: downstream, subscriptions: ['foo'] }])}\n`,
      )
      const one = await getAction('dist').execute(testContext(root), { positionals: ['foo'], flags: {} })
      expect(one.ok).toBe(true)
      expect(readFileSync(join(downstream, '.claude/rules/foo.md'), 'utf8')).toBe('# foo\n')
      const allSynced = await getAction('dist').execute(testContext(root), { positionals: [], flags: { all: true } })
      expect(allSynced.ok).toBe(true)
      expect(allSynced.message).toBe('nothing to distribute')
    } finally {
      rmSync(root, { recursive: true, force: true })
      rmSync(downstream, { recursive: true, force: true })
    }
  })
})
