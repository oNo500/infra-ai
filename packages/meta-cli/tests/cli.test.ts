import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderSkills, renderStatus } from '../src/cli/render'
import { buildCatalog, renderCatalog } from '../src/core/catalog'
import { runCommand } from '../src/core/io'
import { sha256 } from '../src/core/io'
import { metaContentHash } from '../src/core/meta'

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
  test('renderStatus aligns rows', () => {
    const out = renderStatus({
      rows: [
        {
          name: 'foo',
          kind: 'rule',
          status: 'synced',
          scope: 'global',
          tags: [],
          requires: [],
          metaPath: 'meta/rules/foo.md',
          artifactPath: 'rules/global/foo.md',
        },
      ],
      violations: [],
    })
    expect(out).toContain('foo')
    expect(out).toContain('synced')
  })
  test('renderStatus lists violations', () => {
    const out = renderStatus({ rows: [], violations: ["a: unknown tag 'nope' (not in meta/tags.json)"] })
    expect(out).toContain("violation: a: unknown tag 'nope' (not in meta/tags.json)")
  })
  test('renderSkills produces deterministic text', () => {
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
      const data = JSON.parse(res.stdout) as { rows: { name: string; status: string }[]; violations: string[] }
      expect(data.rows[0]?.name).toBe('foo')
      expect(data.rows[0]?.status).toBe('unbuilt')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('status exits 0 when synced', async () => {
    const root = cliFixture()
    try {
      writeFileSync(
        join(root, 'meta/rules/foo.md'),
        '---\nname: foo\ntarget: rule\nstatus: ready\nscope: global\ndescription: demo rule\ntags: [ts]\n---\nbody\n',
      )
      writeFileSync(join(root, 'meta/tags.json'), '{"lang":{"exclusive":true,"values":{"ts":"x"}}}')
      const meta = readFileSync(join(root, 'meta/rules/foo.md'), 'utf8')
      mkdirSync(join(root, 'rules/global'), { recursive: true })
      writeFileSync(join(root, 'rules/global/foo.md'), '# foo\n')
      writeFileSync(
        join(root, 'artifacts.lock.json'),
        `${JSON.stringify({ 'rule:foo': { metaHash: metaContentHash(meta), artifactHash: sha256('# foo\n'), builtAt: 't' } })}\n`,
      )
      writeFileSync(join(root, 'catalog.json'), renderCatalog(buildCatalog(root, () => 't')))
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
      expect(bad.stderr).toContain('log: ')
      expect(bad.stderr).toContain('.imeta/logs/')
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
