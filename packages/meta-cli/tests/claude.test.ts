import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { MetaAsset } from '../src/core/meta'
import {
  allowedToolsFor,
  buildPromptFor,
  parseStreamJsonLine,
  recordBuild,
  verifyBuild,
  writebackPromptFor,
} from '../src/core/claude'

const ruleAsset: MetaAsset = {
  name: 'constitution',
  kind: 'rule',
  status: 'ready',
  scope: 'global',
  metaPath: 'meta/rules/constitution.md',
  artifactPath: 'rules/global/constitution.md',
}

const skillAsset: MetaAsset = {
  name: 'commit-lite',
  kind: 'skill',
  status: 'ready',
  scope: null,
  metaPath: 'meta/skills/commit-lite.md',
  artifactPath: 'skills/commit-lite/SKILL.md',
}

describe('parseStreamJsonLine', () => {
  test('assistant event yields concatenated text blocks', () => {
    const payload = {
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'hello' }, { type: 'tool_use', name: 'Write' }] },
    }
    const line = JSON.stringify(payload)
    expect(parseStreamJsonLine(line)).toEqual({ type: 'assistant', text: 'hello', raw: payload })
  })
  test('result event has type result', () => {
    const payload = { type: 'result', result: 'done' }
    const line = JSON.stringify(payload)
    expect(parseStreamJsonLine(line)).toEqual({ type: 'result', text: 'done', raw: payload })
  })
  test('blank or invalid lines yield null', () => {
    expect(parseStreamJsonLine('')).toBeNull()
    expect(parseStreamJsonLine('not json')).toBeNull()
  })
})

describe('prompts', () => {
  test('build prompt references meta path, build rule, artifact path', () => {
    const p = buildPromptFor(ruleAsset)
    expect(p).toContain('meta/rules/constitution.md')
    expect(p).toContain('meta/build/rule.md')
    expect(p).toContain('rules/global/constitution.md')
  })
  test('writeback prompt references both paths and restricts edits to meta', () => {
    const p = writebackPromptFor(ruleAsset)
    expect(p).toContain('meta/rules/constitution.md')
    expect(p).toContain('rules/global/constitution.md')
  })
})

describe('allowedToolsFor', () => {
  test('build allows writing artifact area only', () => {
    expect(allowedToolsFor(ruleAsset, 'build')).toBe(
      'Read,Glob,Grep,Write(rules/**),Edit(rules/**)',
    )
    expect(allowedToolsFor(skillAsset, 'build')).toBe(
      'Read,Glob,Grep,Write(skills/commit-lite/**),Edit(skills/commit-lite/**),WebFetch(domain:ungh.cc)',
    )
  })
  test('writeback grants no upstream access even for skills', () => {
    expect(allowedToolsFor(skillAsset, 'writeback')).toBe(
      'Read,Glob,Grep,Write(meta/skills/commit-lite.md),Edit(meta/skills/commit-lite.md)',
    )
  })
  test('writeback allows writing the meta file only', () => {
    expect(allowedToolsFor(ruleAsset, 'writeback')).toBe(
      'Read,Glob,Grep,Write(meta/rules/constitution.md),Edit(meta/rules/constitution.md)',
    )
  })
})

describe('verifyBuild and recordBuild', () => {
  test('missing artifact fails; valid artifact passes and records lock', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      writeFileSync(join(root, 'skills.json'), '[]\n')
      mkdirSync(join(root, 'meta/rules'), { recursive: true })
      writeFileSync(join(root, 'meta/rules/constitution.md'), '---\nname: constitution\n---\n')
      expect(verifyBuild(root, ruleAsset)).toMatch(/missing/u)

      mkdirSync(join(root, 'rules/global'), { recursive: true })
      writeFileSync(join(root, 'rules/global/constitution.md'), '# Constitution\n')
      expect(verifyBuild(root, ruleAsset)).toBeNull()

      recordBuild(root, ruleAsset, '2026-07-11T00:00:00Z')
      const lock = JSON.parse(readFileSync(join(root, 'artifacts.lock.json'), 'utf8')) as Record<
        string,
        { metaHash: string; artifactHash: string; builtAt: string }
      >
      const entry = lock['rule:constitution']
      expect(entry?.builtAt).toBe('2026-07-11T00:00:00Z')
      expect(entry?.metaHash).toHaveLength(64)
      expect(entry?.artifactHash).toHaveLength(64)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('skill artifact with mismatched frontmatter name fails', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      mkdirSync(join(root, 'skills/commit-lite'), { recursive: true })
      writeFileSync(join(root, 'skills/commit-lite/SKILL.md'), '---\nname: wrong\n---\nbody\n')
      expect(verifyBuild(root, skillAsset)).toMatch(/name/u)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
