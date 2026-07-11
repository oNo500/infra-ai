import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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

function syncLock(root: string): void {
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
