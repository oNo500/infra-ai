import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildCatalog, catalogStaleness, loadCatalog, renderCatalog } from '../src/core/catalog'

function fixtureRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'imeta-catalog-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  writeFileSync(join(dir, 'meta', 'tags.json'), JSON.stringify({ concern: { exclusive: false, values: { core: '核心' } } }))
  writeFileSync(join(dir, 'meta', 'rules', 'alpha.md'), '---\nname: alpha\nstatus: ready\nscope: global\ndescription: 甲说明\ntags: [core]\n---\nbody')
  writeFileSync(join(dir, 'meta', 'rules', 'beta.md'), '---\nname: beta\nstatus: ready\nscope: global\ndescription: 乙说明\ntags: [core]\n---\nbody')
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { description: 'd', rules: ['alpha'] } }))
  return dir
}

describe('catalog', () => {
  test('buildCatalog derives rules with description, tags, profile membership', () => {
    const repo = fixtureRepo()
    const catalog = buildCatalog(repo, () => '2026-07-19T00:00:00Z')
    expect(Object.keys(catalog.rules)).toEqual(['alpha', 'beta'])
    expect(catalog.rules.alpha).toEqual({
      description: '甲说明', tags: ['core'], scope: 'global',
      path: 'rules/global/alpha.md', profiles: ['demo'],
    })
    expect(catalog.rules.beta?.profiles).toEqual([])
    expect(catalog.tags.concern?.values.core).toBe('核心')
  })

  test('staleness: missing file, then fresh after write, then stale after meta change', () => {
    const repo = fixtureRepo()
    expect(catalogStaleness(repo)).toContain('catalog.json missing')
    writeFileSync(join(repo, 'catalog.json'), renderCatalog(buildCatalog(repo, () => 'x')))
    expect(loadCatalog(repo)?.generatedAt).toBe('x')
    expect(catalogStaleness(repo)).toBeNull()
    writeFileSync(join(repo, 'meta', 'rules', 'alpha.md'), '---\nname: alpha\nstatus: ready\nscope: global\ndescription: 改了\ntags: [core]\n---\nbody')
    expect(catalogStaleness(repo)).toContain('stale')
  })
})
