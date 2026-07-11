import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { artifactPathFor, discoverAssets, parseMetaFile } from '../src/core/meta'

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
      metaPath: 'meta/rules/constitution.md',
      artifactPath: 'rules/global/constitution.md',
    })
  })
  test('missing status defaults to stub, missing name falls back to filename', () => {
    const asset = parseMetaFile('---\ntarget: rule\n---\n', 'python.md', 'rule')
    expect(asset.name).toBe('python')
    expect(asset.status).toBe('stub')
    expect(asset.scope).toBeNull()
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
})
