import { describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadProfiles, loadTagVocabulary, validateComposition } from '../src/core/composition'
import type { MetaAsset } from '../src/core/meta'

function rule(name: string, tags: string[], requires: string[] = [], status: 'ready' | 'stub' = 'ready'): MetaAsset {
  return { name, kind: 'rule', status, scope: 'global', tags, requires, metaPath: `meta/rules/${name}.md`, artifactPath: `rules/global/${name}.md`, description: 'desc', refUrl: '' }
}

const VOCAB = {
  lang: { exclusive: true, values: { ts: 'x', python: 'x' } },
  concern: { exclusive: false, values: { core: 'x', docs: 'x' } },
}

describe('validateComposition', () => {
  test('accepts a clean setup', () => {
    const assets = [
      rule('constitution', ['core']),
      rule('typescript', ['ts']),
      rule('markdown', ['docs']),
      rule('python-rule', ['python']),
      rule('react', ['ts'], ['typescript']),
    ]
    const profiles = { app: { rules: ['constitution', 'typescript', 'react'] } }
    expect(validateComposition(assets, VOCAB, profiles)).toEqual([])
  })
  test('flags unknown tag, missing tags on ready rule, dangling requires', () => {
    const assets = [rule('constitution', ['nope', 'core']), rule('typescript', []), rule('react', ['ts', 'docs'], ['ghost']), rule('py', ['python'])]
    const v = validateComposition(assets, VOCAB, {})
    expect(v).toContain("constitution: unknown tag 'nope' (not in meta/tags.json)")
    expect(v).toContain('typescript: ready rule must declare tags')
    expect(v).toContain("react: requires unknown rule 'ghost'")
  })
  test('flags two tags from the same exclusive facet', () => {
    const assets = [rule('a', ['ts', 'python', 'core']), rule('b', ['docs'])]
    const v = validateComposition(assets, VOCAB, {})
    expect(v).toContain("a: tags 'ts' and 'python' are mutually exclusive within facet 'lang'")
  })
  test('flags orphan vocabulary tags', () => {
    const assets = [rule('a', ['ts', 'core']), rule('b', ['docs'])]
    const v = validateComposition(assets, VOCAB, {})
    expect(v).toContain("orphan tag 'python' in meta/tags.json: no rule uses it")
  })
  test('stub rule may omit tags', () => {
    // 孤儿校验在本用例里会报词表项，只断言无 stub 相关违规
    const v = validateComposition([rule('python-note', [], [], 'stub')], VOCAB, {})
    expect(v.filter((m) => m.startsWith('python-note:'))).toEqual([])
  })
  test('flags profile violations: unknown rule, unmet requires, missing constitution', () => {
    const assets = [rule('constitution', ['core']), rule('typescript', ['ts']), rule('markdown', ['docs']), rule('py', ['python']), rule('react', ['ts'], ['typescript'])]
    const v = validateComposition(assets, VOCAB, { bad: { rules: ['react', 'ghost'] } })
    expect(v).toContain("profile bad: unknown rule 'ghost'")
    expect(v).toContain("profile bad: 'react' requires 'typescript' which is not in the profile")
    expect(v).toContain('profile bad: missing constitution')
  })
  test('ready rule without description is a violation; stub without is fine', () => {
    const assets: MetaAsset[] = [
      { name: 'a', kind: 'rule', status: 'ready', scope: 'global', tags: ['core'], requires: [], metaPath: 'meta/rules/a.md', artifactPath: 'rules/global/a.md', description: '', refUrl: '' },
      { name: 'b', kind: 'rule', status: 'stub', scope: 'global', tags: ['core'], requires: [], metaPath: 'meta/rules/b.md', artifactPath: 'rules/global/b.md', description: '', refUrl: '' },
    ]
    const violations = validateComposition(assets, VOCAB, {})
    expect(violations).toContain('a: ready rule missing description')
    expect(violations.some((v) => v.startsWith('b:'))).toBe(false)
  })
})

describe('loaders', () => {
  test('missing files load as empty', () => {
    const dir = mkdtempSync(join(tmpdir(), 'comp-'))
    expect(loadTagVocabulary(dir)).toEqual({})
    expect(loadProfiles(dir)).toEqual({})
  })
  test('malformed profiles throw RegistryError with file and field', () => {
    const dir = mkdtempSync(join(tmpdir(), 'comp-'))
    writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ app: { rules: 'not-array' } }))
    expect(() => loadProfiles(dir)).toThrow("profiles.json: profile 'app' must carry a string[] rules field")
  })
  test('malformed vocabulary throws RegistryError', () => {
    const dir = mkdtempSync(join(tmpdir(), 'comp-'))
    mkdirSync(join(dir, 'meta'))
    writeFileSync(join(dir, 'meta', 'tags.json'), JSON.stringify({ lang: { values: { ts: 'x' } } }))
    expect(() => loadTagVocabulary(dir)).toThrow("meta/tags.json: facet 'lang' must carry boolean exclusive and a values object")
  })
  test('duplicate tag across facets throws RegistryError', () => {
    const dir = mkdtempSync(join(tmpdir(), 'comp-'))
    mkdirSync(join(dir, 'meta'))
    writeFileSync(join(dir, 'meta', 'tags.json'), JSON.stringify({
      lang: { exclusive: true, values: { ts: 'x' } },
      concern: { exclusive: false, values: { ts: 'y' } },
    }))
    expect(() => loadTagVocabulary(dir)).toThrow("meta/tags.json: tag 'ts' appears in more than one facet")
  })
})
