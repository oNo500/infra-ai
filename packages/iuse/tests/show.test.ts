import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Catalog } from '@infra-ai/meta-cli/core'
import { showReport } from '../src/core/show'

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-show-src-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  mkdirSync(join(dir, 'rules', 'global'), { recursive: true })

  writeFileSync(
    join(dir, 'meta', 'rules', 'alpha.md'),
    '---\nname: alpha\nstatus: ready\ndescription: 甲说明\nscope: global\ntags: [core]\n---\nbody',
  )

  const catalog: Catalog = {
    generatedAt: '2026-07-18T00:00:00Z',
    tags: { concern: { exclusive: false, values: { core: 'core concern' } } },
    rules: {
      alpha: {
        description: '甲说明',
        tags: ['core'],
        scope: 'global',
        path: 'rules/global/alpha.md',
        profiles: ['demo'],
      },
    },
  }
  writeFileSync(join(dir, 'catalog.json'), JSON.stringify(catalog, null, 2))
  writeFileSync(join(dir, 'rules', 'global', 'alpha.md'), '# Alpha\n\nbody\n')
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { description: 'Demo', rules: ['alpha'] } }))
  return dir
}

function bareSourceFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-show-bare-src-'))
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({}))
  return dir
}

function fakeCtx(): import('../src/core/init').IuseContext {
  return {
    download: async () => ({}),
    run: async () => ({ code: 0, stdout: 'head1\n', stderr: '' }),
    claude: async () => ({ code: 0, timedOut: false, stderr: '' }),
    now: () => '2026-07-18T00:00:00Z',
    env: {},
    home: '/nope',
    cacheDir: '/tmp/iuse-show-cache',
  }
}

describe('showReport', () => {
  test('show returns entry metadata and artifact content; unknown name exits 1', async () => {
    const source = fixtureSource()
    const uninitTarget = mkdtempSync(join(tmpdir(), 'iuse-show-uninit-'))

    const hit = await showReport(fakeCtx(), { source, target: uninitTarget, name: 'alpha' })
    expect(hit.ok).toBe(true)
    expect(hit.entry?.description).toBe('甲说明')
    expect(hit.content).toContain('body')
    expect(hit.exitCode).toBe(0)

    const miss = await showReport(fakeCtx(), { source, target: uninitTarget, name: 'ghost' })
    expect(miss.ok).toBe(false)
    expect(miss.exitCode).toBe(1)
    expect(miss.message).toContain('alpha')
  })

  test('artifact file missing on source: entry.state is broken, content omitted, still ok', async () => {
    const source = fixtureSource()
    rmSync(join(source, 'rules', 'global', 'alpha.md'))
    const uninitTarget = mkdtempSync(join(tmpdir(), 'iuse-show-uninit-'))

    const result = await showReport(fakeCtx(), { source, target: uninitTarget, name: 'alpha' })

    expect(result.ok).toBe(true)
    expect(result.exitCode).toBe(0)
    expect(result.entry?.state).toBe('broken')
    expect(result.content).toBeUndefined()
  })

  test('missing catalog fails with imeta catalog hint', async () => {
    const bareSource = bareSourceFixture()
    const uninitTarget = mkdtempSync(join(tmpdir(), 'iuse-show-uninit-'))

    const result = await showReport(fakeCtx(), { source: bareSource, target: uninitTarget, name: 'alpha' })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('imeta catalog')
    expect(result.exitCode).toBe(1)
  })

  test('source resolution failure fails cleanly with exitCode 1', async () => {
    const badSource = mkdtempSync(join(tmpdir(), 'iuse-show-badsrc-'))
    const uninitTarget = mkdtempSync(join(tmpdir(), 'iuse-show-uninit-'))

    const result = await showReport(fakeCtx(), { source: badSource, target: uninitTarget, name: 'alpha' })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('profiles.json not found')
    expect(result.exitCode).toBe(1)
  })
})
