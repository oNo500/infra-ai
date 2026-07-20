import { describe, expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadCatalog, loadProfiles } from '../src/core/contract'

function dir(): string {
  return mkdtempSync(join(tmpdir(), 'iuse-contract-'))
}

describe('schema-validated loaders', () => {
  test('valid files load with their parsed shape', () => {
    const d = dir()
    writeFileSync(
      join(d, 'catalog.json'),
      JSON.stringify({
        generatedAt: '2026-07-20T00:00:00Z',
        tags: { lang: { exclusive: true, values: { ts: 'TypeScript' } } },
        rules: {
          constitution: { description: 'x', tags: ['ts'], requires: [], path: 'rules/constitution.md', profiles: [] },
        },
      }),
    )
    writeFileSync(join(d, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution'] } }))
    expect(loadCatalog(d)?.rules['constitution']?.path).toBe('rules/constitution.md')
    expect(loadProfiles(d)['demo']?.rules).toEqual(['constitution'])
  })

  test('missing files keep the established semantics', () => {
    const d = dir()
    expect(loadCatalog(d)).toBeNull()
    expect(loadProfiles(d)).toEqual({})
  })

  test('schema violation throws with the update hint', () => {
    const d = dir()
    writeFileSync(join(d, 'catalog.json'), JSON.stringify({ rules: {} }))
    expect(() => loadCatalog(d)).toThrow(/catalog\.json: .*update the checkout/u)
  })

  test('invalid JSON keeps the invalid JSON message', () => {
    const d = dir()
    writeFileSync(join(d, 'profiles.json'), '{nope')
    expect(() => loadProfiles(d)).toThrow(/profiles\.json: invalid JSON/u)
  })
})
