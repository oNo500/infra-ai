import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ACTIONS, defaultContext } from '../src/core/actions'

function fixtureRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'imeta-links-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  writeFileSync(join(dir, 'skills.json'), JSON.stringify([
    { name: 'sk-broken', source: 'official', repo: 'x/y', refUrl: 'https://gone.example/doc' },
    { name: 'sk-moved', source: 'official', repo: 'x/z', refUrl: 'https://old.example/doc' },
    { name: 'sk-plain', source: 'custom' },
  ]))
  writeFileSync(join(dir, 'meta', 'rules', 'r1.md'),
    '---\nname: r1\nstatus: ready\nscope: global\ndescription: x\nrefUrl: https://ok.example/doc\ntags: [core]\n---\nbody')
  return dir
}

function findLinks() {
  const action = ACTIONS.find((a) => a.id === 'links')
  if (action === undefined) throw new Error('links action not registered')
  return action
}

function ctxWith(repoRoot: string, responses: Record<string, { status: number; location?: string } | 'throw'>) {
  return {
    ...defaultContext(repoRoot),
    fetchStatus: async (url: string) => {
      const r = responses[url]
      if (r === undefined) throw new Error(`unexpected url ${url}`)
      if (r === 'throw') throw new Error('network down')
      return r
    },
  }
}

describe('links action', () => {
  test('classifies broken/moved/ok and exits 1 when any needs update', async () => {
    const repo = fixtureRepo()
    const result = await findLinks().execute(ctxWith(repo, {
      'https://gone.example/doc': { status: 404 },
      'https://old.example/doc': { status: 301, location: 'https://new.example/doc' },
      'https://ok.example/doc': { status: 200 },
    }), { positionals: [], flags: {} })
    expect(result.exitCode).toBe(1)
    const rows = (result.data as { rows: { asset: string; verdict: string; location?: string }[] }).rows
    expect(rows.find((r) => r.asset.includes('sk-broken'))?.verdict).toBe('broken')
    expect(rows.find((r) => r.asset.includes('sk-moved'))?.verdict).toBe('moved')
    expect(rows.find((r) => r.asset.includes('sk-moved'))?.location).toBe('https://new.example/doc')
    expect(rows.find((r) => r.asset.includes('r1'))?.verdict).toBe('ok')
    expect(result.message).toContain('参考来源需更新')
    expect(result.message).toContain('https://gone.example/doc')
  })

  test('unreachable is a warning, not a failure', async () => {
    const repo = fixtureRepo()
    const result = await findLinks().execute(ctxWith(repo, {
      'https://gone.example/doc': 'throw',
      'https://old.example/doc': { status: 200 },
      'https://ok.example/doc': { status: 200 },
    }), { positionals: [], flags: {} })
    expect(result.exitCode ?? 0).toBe(0)
    const rows = (result.data as { rows: { asset: string; verdict: string }[] }).rows
    expect(rows.find((r) => r.asset.includes('sk-broken'))?.verdict).toBe('unreachable')
  })

  test('no refUrl anywhere yields clean empty run', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'imeta-links-empty-'))
    mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
    const result = await findLinks().execute(ctxWith(dir, {}), { positionals: [], flags: {} })
    expect(result.ok).toBe(true)
    expect(result.exitCode ?? 0).toBe(0)
  })
})
