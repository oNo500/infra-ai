import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { artifactPathFor, discoverAssets, metaContentHash, parseMetaFile } from '../src/core/meta'

describe('artifactPathFor', () => {
  test('rule global', () => {
    expect(artifactPathFor('rule', 'constitution', 'global')).toBe('rules/global/constitution.md')
  })
  test('rule scoped', () => {
    expect(artifactPathFor('rule', 'api', 'src/api/**/*.ts')).toBe('rules/scoped/api.md')
  })
  test('rule without scope defaults to global', () => {
    expect(artifactPathFor('rule', 'python', null)).toBe('rules/global/python.md')
  })
  test('skill', () => {
    expect(artifactPathFor('skill', 'commit-lite', null)).toBe('skills/commit-lite/SKILL.md')
  })
  test('template', () => {
    expect(artifactPathFor('template', 'architecture', null)).toBe('templates/architecture.md')
  })
})

describe('parseMetaFile', () => {
  test('parses frontmatter fields', () => {
    const content = '---\nname: constitution\ntarget: rule\nstatus: ready\nscope: global\n---\n\nbody\n'
    const asset = parseMetaFile(content, 'constitution.md', 'rule')
    expect(asset).toEqual({
      name: 'constitution',
      kind: 'rule',
      status: 'ready',
      scope: 'global',
      tags: [],
      requires: [],
      metaPath: 'meta/rules/constitution.md',
      artifactPath: 'rules/global/constitution.md',
      description: '',
    })
  })
  test('missing status defaults to stub, missing name falls back to filename', () => {
    const asset = parseMetaFile('---\ntarget: rule\n---\n', 'python.md', 'rule')
    expect(asset.name).toBe('python')
    expect(asset.status).toBe('stub')
    expect(asset.scope).toBeNull()
  })

  test('crafted path-traversal name falls back to filename stem', () => {
    const asset = parseMetaFile('---\nname: "../../x"\n---\n', 'python.md', 'rule')
    expect(asset.name).toBe('python')
  })

  test('crafted allowedTools-injection name falls back to filename stem', () => {
    const asset = parseMetaFile('---\nname: "x),Bash(*"\n---\n', 'python.md', 'rule')
    expect(asset.name).toBe('python')
  })

  test('valid frontmatter name passes through unchanged', () => {
    const asset = parseMetaFile('---\nname: my-rule_2.0\n---\n', 'python.md', 'rule')
    expect(asset.name).toBe('my-rule_2.0')
  })

  test('invalid filename stem throws naming the file', () => {
    expect(() => parseMetaFile('---\n---\n', '../evil.md', 'rule')).toThrow(/\.\.\/evil\.md/u)
  })
})

describe('discoverAssets', () => {
  test('scans meta subdirs and sorts by kind then name', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      mkdirSync(join(root, 'meta/rules'), { recursive: true })
      mkdirSync(join(root, 'meta/skills'), { recursive: true })
      mkdirSync(join(root, 'meta/templates'), { recursive: true })
      writeFileSync(
        join(root, 'meta/rules/constitution.md'),
        '---\nname: constitution\ntarget: rule\nstatus: ready\nscope: global\n---\n',
      )
      writeFileSync(
        join(root, 'meta/skills/commit-lite.md'),
        '---\nname: commit-lite\ntarget: skill\nstatus: ready\n---\n',
      )
      const assets = discoverAssets(root)
      expect(assets.map((a) => a.name)).toEqual(['constitution', 'commit-lite'])
      expect(assets.map((a) => a.kind)).toEqual(['rule', 'skill'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('throws when two meta files in the same kind resolve to the same name', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      mkdirSync(join(root, 'meta/rules'), { recursive: true })
      writeFileSync(
        join(root, 'meta/rules/a.md'),
        '---\nname: dup\ntarget: rule\nstatus: ready\n---\n',
      )
      writeFileSync(
        join(root, 'meta/rules/b.md'),
        '---\nname: dup\ntarget: rule\nstatus: ready\n---\n',
      )
      expect(() => discoverAssets(root)).toThrow(
        /dup.*a\.md.*b\.md|meta\/rules\/a\.md.*meta\/rules\/b\.md/u,
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('metaContentHash', () => {
  test('ignores tags and requires', () => {
    const base = `---\nname: a\nstatus: ready\nscope: global\n---\nbody`
    const tagged = `---\nname: a\nstatus: ready\nscope: global\ntags: [ts]\nrequires: [b]\n---\nbody`
    expect(metaContentHash(tagged)).toBe(metaContentHash(base))
  })

  test('changes with body and with scope', () => {
    const a = `---\nname: a\nstatus: ready\nscope: global\n---\nbody`
    expect(metaContentHash(`---\nname: a\nstatus: ready\nscope: global\n---\nother`)).not.toBe(
      metaContentHash(a),
    )
    expect(metaContentHash(`---\nname: a\nstatus: ready\nscope: "**/*.ts"\n---\nbody`)).not.toBe(
      metaContentHash(a),
    )
  })
})

describe('parseMetaFile description', () => {
  test('parseMetaFile surfaces frontmatter description, defaults to empty string', () => {
    const withDesc = parseMetaFile(
      '---\nname: demo\nstatus: ready\nscope: global\ndescription: 一句话说明\ntags: [core]\n---\nbody',
      'demo.md',
      'rule',
    )
    expect(withDesc.description).toBe('一句话说明')

    const without = parseMetaFile('---\nname: demo2\nstatus: ready\n---\nbody', 'demo2.md', 'rule')
    expect(without.description).toBe('')
  })
})

describe('parseMetaFile tags and requires', () => {
  test('parses tags and requires arrays from frontmatter', () => {
    const content = `---\nname: react\nstatus: ready\nscope: "**/*.tsx"\ntags: [ts, frontend]\nrequires: [typescript]\n---\nbody`
    const asset = parseMetaFile(content, 'react.md', 'rule')
    expect(asset.tags).toEqual(['ts', 'frontend'])
    expect(asset.requires).toEqual(['typescript'])
  })

  test('defaults tags and requires to empty arrays', () => {
    const content = `---\nname: python\nstatus: stub\n---\n`
    const asset = parseMetaFile(content, 'python.md', 'rule')
    expect(asset.tags).toEqual([])
    expect(asset.requires).toEqual([])
  })

  test('drops non-string entries in tags and requires', () => {
    const content = `---\nname: x\nstatus: ready\ntags: [ok, 3]\nrequires: 5\n---\n`
    const asset = parseMetaFile(content, 'x.md', 'rule')
    expect(asset.tags).toEqual(['ok'])
    expect(asset.requires).toEqual([])
  })
})
