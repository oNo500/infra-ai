import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
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
