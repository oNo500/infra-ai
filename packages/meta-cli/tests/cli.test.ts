import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderSkills, renderStatus, renderTargets } from '../src/cli/render'
import { runCommand } from '../src/core/io'
import { sha256 } from '../src/core/io'

const INDEX = join(import.meta.dir, '..', 'src', 'index.tsx')

function cliFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
  writeFileSync(join(root, 'skills.json'), '[]\n')
  mkdirSync(join(root, 'meta/rules'), { recursive: true })
  writeFileSync(
    join(root, 'meta/rules/foo.md'),
    '---\nname: foo\ntarget: rule\nstatus: ready\nscope: global\n---\nbody\n',
  )
  return root
}

describe('renderers', () => {
  test('renderStatus aligns rows and shows downstream summary for rules', () => {
    const out = renderStatus([
      {
        name: 'foo',
        kind: 'rule',
        status: 'synced',
        scope: 'global',
        metaPath: 'meta/rules/foo.md',
        artifactPath: 'rules/global/foo.md',
        downstream: { synced: 1, drift: 0, missing: 1 },
        targets: [],
      },
    ])
    expect(out).toContain('foo')
    expect(out).toContain('1 synced, 1 missing')
  })
  test('renderTargets and renderSkills produce deterministic text', () => {
    expect(renderTargets([])).toBe('no targets')
    expect(renderTargets([{ path: '/a', subscriptions: ['x'] }])).toBe('/a  [x]')
    const out = renderSkills({
      issues: [],
      mirrors: [{ name: 'm', localCommit: 'aaaaaaa1', remoteCommit: 'aaaaaaa1', outdated: false }],
      installed: ['s1'],
      recommendations: [{ name: 'r', repo: 'o/r' }],
    })
    expect(out).toContain('ledger clean')
    expect(out).toContain('[up-to-date] m')
    expect(out).toContain('s1')
    expect(out).toContain('pnpx skills add o/r')
  })
})

describe('cli end-to-end', () => {
  test('status --json exits 1 on unbuilt asset with row data', async () => {
    const root = cliFixture()
    try {
      const res = await runCommand('bun', ['run', INDEX, 'status', '--json'], { cwd: root })
      expect(res.code).toBe(1)
      const rows = JSON.parse(res.stdout) as { name: string; status: string }[]
      expect(rows[0]?.name).toBe('foo')
      expect(rows[0]?.status).toBe('unbuilt')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('status exits 0 when synced', async () => {
    const root = cliFixture()
    try {
      const meta = readFileSync(join(root, 'meta/rules/foo.md'), 'utf8')
      mkdirSync(join(root, 'rules/global'), { recursive: true })
      writeFileSync(join(root, 'rules/global/foo.md'), '# foo\n')
      writeFileSync(
        join(root, 'artifacts.lock.json'),
        `${JSON.stringify({ 'rule:foo': { metaHash: sha256(meta), artifactHash: sha256('# foo\n'), builtAt: 't' } })}\n`,
      )
      const res = await runCommand('bun', ['run', INDEX, 'status'], { cwd: root })
      expect(res.code).toBe(0)
      expect(res.stdout).toContain('synced')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('adopt via subcommand writes the lock; failure paths exit 1 with stderr', async () => {
    const root = cliFixture()
    try {
      mkdirSync(join(root, 'rules/global'), { recursive: true })
      writeFileSync(join(root, 'rules/global/foo.md'), '# foo\n')
      const ok = await runCommand('bun', ['run', INDEX, 'adopt', 'foo'], { cwd: root })
      expect(ok.code).toBe(0)
      const lock = JSON.parse(readFileSync(join(root, 'artifacts.lock.json'), 'utf8')) as Record<string, unknown>
      expect(lock['rule:foo']).toBeDefined()
      const bad = await runCommand('bun', ['run', INDEX, 'adopt', 'nope'], { cwd: root })
      expect(bad.code).toBe(1)
      expect(bad.stderr).toContain('unknown asset')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('nested targets commands work end-to-end', async () => {
    const root = cliFixture()
    try {
      const add = await runCommand('bun', ['run', INDEX, 'targets', 'add', '/tmp/cli-demo'], { cwd: root })
      expect(add.code).toBe(0)
      const dup = await runCommand('bun', ['run', INDEX, 'targets', 'add', '/tmp/cli-demo'], { cwd: root })
      expect(dup.code).toBe(1)
      const list = await runCommand('bun', ['run', INDEX, 'targets', 'list', '--json'], { cwd: root })
      expect(JSON.parse(list.stdout)).toEqual([{ path: '/tmp/cli-demo', subscriptions: [] }])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('running outside a repo root fails fast', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'meta-cli-empty-'))
    try {
      const res = await runCommand('bun', ['run', INDEX, 'status'], { cwd: empty })
      expect(res.code).toBe(1)
      expect(res.stderr).toContain('skills.json not found')
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })
})
