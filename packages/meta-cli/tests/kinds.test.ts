import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { KINDS, KIND_ORDER } from '../src/core/kinds'

const REPO_ROOT = join(import.meta.dir, '..', '..', '..')

describe('kind registry', () => {
  test('covers all kinds in stable order', () => {
    expect(KIND_ORDER).toEqual(['rule', 'skill', 'template'])
    expect(Object.keys(KINDS).toSorted()).toEqual(['rule', 'skill', 'template'])
  })
  test('prompt documents referenced by the registry exist in the repo', () => {
    for (const kind of KIND_ORDER) {
      expect(existsSync(join(REPO_ROOT, KINDS[kind].buildPrompt)), KINDS[kind].buildPrompt).toBe(true)
      expect(existsSync(join(REPO_ROOT, KINDS[kind].writebackPrompt)), KINDS[kind].writebackPrompt).toBe(true)
    }
  })
  test('artifact paths and sandbox globs match established contracts', () => {
    expect(KINDS.rule.artifactPath('constitution', 'global')).toBe('rules/global/constitution.md')
    expect(KINDS.rule.artifactPath('api', 'src/api/**')).toBe('rules/scoped/api.md')
    expect(KINDS.rule.artifactPath('python', null)).toBe('rules/global/python.md')
    expect(KINDS.skill.artifactPath('commit-lite', null)).toBe('skills/commit-lite/SKILL.md')
    expect(KINDS.template.artifactPath('architecture', null)).toBe('templates/architecture.md')
    expect(KINDS.rule.writableGlob('constitution')).toBe('rules/**')
    expect(KINDS.skill.writableGlob('commit-lite')).toBe('skills/commit-lite/**')
    expect(KINDS.template.writableGlob('architecture')).toBe('templates/**')
    expect(KINDS.skill.extraAllowedTools).toEqual(['WebFetch(domain:ungh.cc)'])
    expect(KINDS.rule.extraAllowedTools).toEqual([])
    expect(KINDS.template.extraAllowedTools).toEqual([])
  })
})

describe('rule verifyArtifact', () => {
  test('scoped rule requires paths frontmatter matching scope', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      mkdirSync(join(root, 'rules/scoped'), { recursive: true })
      const asset = { name: 'api', artifactPath: 'rules/scoped/api.md', scope: 'src/api/**' }
      writeFileSync(join(root, asset.artifactPath), '---\npaths:\n  - "src/api/**"\n---\nbody\n')
      expect(KINDS.rule.verifyArtifact(root, asset)).toBeNull()
      writeFileSync(join(root, asset.artifactPath), 'no frontmatter\n')
      expect(KINDS.rule.verifyArtifact(root, asset)).toMatch(/paths/u)
      writeFileSync(join(root, asset.artifactPath), '---\npaths:\n  - "src/other/**"\n---\n')
      expect(KINDS.rule.verifyArtifact(root, asset)).toMatch(/paths/u)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('global rule must not carry paths frontmatter', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      mkdirSync(join(root, 'rules/global'), { recursive: true })
      const asset = { name: 'constitution', artifactPath: 'rules/global/constitution.md', scope: 'global' }
      writeFileSync(join(root, asset.artifactPath), '# Constitution\n')
      expect(KINDS.rule.verifyArtifact(root, asset)).toBeNull()
      writeFileSync(join(root, asset.artifactPath), '---\npaths:\n  - "x/**"\n---\n')
      expect(KINDS.rule.verifyArtifact(root, asset)).toMatch(/global/u)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('template verifyArtifact', () => {
  test('requires at least one ALL_CAPS placeholder', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      mkdirSync(join(root, 'templates'), { recursive: true })
      const asset = { name: 'architecture', artifactPath: 'templates/architecture.md', scope: null }
      writeFileSync(join(root, asset.artifactPath), '# X\n\n[PROJECT_NAME] here\n')
      expect(KINDS.template.verifyArtifact(root, asset)).toBeNull()
      writeFileSync(join(root, asset.artifactPath), '# X\nno placeholder\n')
      expect(KINDS.template.verifyArtifact(root, asset)).toMatch(/placeholder/u)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
