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
    expect(KINDS.rule.artifactPath('constitution', 'global')).toBe('rules/constitution.md')
    expect(KINDS.rule.artifactPath('api', 'src/api/**')).toBe('rules/api.md')
    expect(KINDS.rule.artifactPath('python', null)).toBe('rules/python.md')
    expect(KINDS.skill.artifactPath('commit-lite', null)).toBe('skills/commit-lite/SKILL.md')
    expect(KINDS.template.artifactPath('architecture', null)).toBe('templates/architecture.md')
    expect(KINDS.rule.writableGlob('constitution')).toBe('rules/**')
    expect(KINDS.skill.writableGlob('commit-lite')).toBe('skills/commit-lite/**')
    expect(KINDS.template.writableGlob('architecture')).toBe('templates/**')
    expect(KINDS.skill.extraAllowedTools).toEqual([])
    expect(KINDS.rule.extraAllowedTools).toEqual([])
    expect(KINDS.template.extraAllowedTools).toEqual([])
  })
})

describe('skill preBuildCheck', () => {
  const asset = { name: 'commit-lite' }
  test('fails when official catalog has a same-named skill', async () => {
    const fetchJson = async () => ({
      files: [{ path: 'plugins/git-tools/skills/commit-lite/SKILL.md' }, { path: 'plugins/x/README.md' }],
    })
    const err = await KINDS.skill.preBuildCheck?.(fetchJson, asset)
    expect(err).toMatch(/official/u)
  })
  test('fails on external_plugins hit', async () => {
    const fetchJson = async () => ({ files: [{ path: 'external_plugins/commit-lite/manifest.json' }] })
    expect(await KINDS.skill.preBuildCheck?.(fetchJson, asset)).toMatch(/official/u)
  })
  test('passes when no hit', async () => {
    const fetchJson = async () => ({ files: [{ path: 'plugins/other/skills/else/SKILL.md' }] })
    expect(await KINDS.skill.preBuildCheck?.(fetchJson, asset)).toBeNull()
  })
  test('rule and template have no preBuildCheck', () => {
    expect(KINDS.rule.preBuildCheck).toBeUndefined()
    expect(KINDS.template.preBuildCheck).toBeUndefined()
  })
})

describe('rule verifyArtifact', () => {
  test('rule artifact with paths frontmatter is a violation regardless of scope', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      mkdirSync(join(root, 'rules'), { recursive: true })
      writeFileSync(join(root, 'rules/api.md'), '---\npaths:\n  - "src/api/**"\n---\n\n# api\n')
      const scoped = { name: 'api', artifactPath: 'rules/api.md', scope: 'src/api/**' }
      expect(KINDS.rule.verifyArtifact(root, scoped)).toMatch(/must not carry paths frontmatter/u)
      const global = { name: 'api', artifactPath: 'rules/api.md', scope: 'global' }
      expect(KINDS.rule.verifyArtifact(root, global)).toMatch(/must not carry paths frontmatter/u)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('rule artifact without frontmatter passes for any scope', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      mkdirSync(join(root, 'rules'), { recursive: true })
      writeFileSync(join(root, 'rules/api.md'), '# api\n')
      expect(KINDS.rule.verifyArtifact(root, { name: 'api', artifactPath: 'rules/api.md', scope: 'src/api/**' })).toBeNull()
      expect(KINDS.rule.verifyArtifact(root, { name: 'api', artifactPath: 'rules/api.md', scope: 'global' })).toBeNull()
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
