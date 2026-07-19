import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Catalog } from '@infra-ai/meta-cli/core'
import { runInit } from '../src/core/init'
import { showReport } from '../src/core/show'

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-show-src-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  mkdirSync(join(dir, 'rules'), { recursive: true })

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
        path: 'rules/alpha.md',
        profiles: ['demo'],
      },
    },
  }
  writeFileSync(join(dir, 'catalog.json'), JSON.stringify(catalog, null, 2))
  writeFileSync(join(dir, 'rules', 'alpha.md'), '# Alpha\n\nbody\n')
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

// runInit 需要 claude 真的落位 staging 文件（instantiateTemplate 校验产物存在），
// 与 tests/list.test.ts 的 fakeClaudeWriting 同一惯用法
function fakeCtxWithInit(): import('../src/core/init').IuseContext {
  return {
    ...fakeCtx(),
    claude: async (opts) => {
      const match = /(?:Write|Edit)\((.+)\)/u.exec(opts.allowedTools)
      const rel = match?.[1]
      if (rel === undefined) throw new Error('no target file in allowedTools')
      const targetFile = join(opts.repoRoot, rel)
      writeFileSync(targetFile, targetFile.endsWith('architecture.md') ? '# demo - Architecture\n\nbody\n' : '# demo\n\nbody\n')
      return { code: 0, timedOut: false, stderr: '' }
    },
  }
}

async function initializedTargetWith(source: string): Promise<string> {
  const target = mkdtempSync(join(tmpdir(), 'iuse-show-tgt-'))
  const result = await runInit(fakeCtxWithInit(), { source, rules: ['alpha'], profile: '-', target, force: false })
  if (!result.ok) throw new Error(`fixture init failed: ${result.message}`)
  return target
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
    rmSync(join(source, 'rules', 'alpha.md'))
    const uninitTarget = mkdtempSync(join(tmpdir(), 'iuse-show-uninit-'))

    const result = await showReport(fakeCtx(), { source, target: uninitTarget, name: 'alpha' })

    expect(result.ok).toBe(true)
    expect(result.exitCode).toBe(0)
    expect(result.entry?.state).toBe('broken')
    expect(result.content).toBeUndefined()
  })

  test('initialized target with an untouched rule: entry.state is synced', async () => {
    const source = fixtureSource()
    const target = await initializedTargetWith(source)

    const result = await showReport(fakeCtx(), { source, target, name: 'alpha' })

    expect(result.ok).toBe(true)
    expect(result.entry?.state).toBe('synced')
  })

  test('initialized target with a locally edited rule: entry.state is modified', async () => {
    const source = fixtureSource()
    const target = await initializedTargetWith(source)
    writeFileSync(join(target, '.claude/rules/alpha.md'), '# Alpha\n\nlocally edited\n')

    const result = await showReport(fakeCtx(), { source, target, name: 'alpha' })

    expect(result.ok).toBe(true)
    expect(result.entry?.state).toBe('modified')
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
