import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { MetaAsset } from '../src/core/meta'
import {
  computeDownstreamState,
  distribute,
  downstreamPath,
  downstreamStates,
  subscribers,
} from '../src/core/dist'

const ruleAsset: MetaAsset = {
  name: 'constitution',
  kind: 'rule',
  status: 'ready',
  scope: 'global',
  metaPath: 'meta/rules/constitution.md',
  artifactPath: 'rules/global/constitution.md',
}

describe('downstreamPath', () => {
  test('lands in .claude/rules', () => {
    expect(downstreamPath('/tmp/proj', 'constitution')).toBe(
      '/tmp/proj/.claude/rules/constitution.md',
    )
  })
})

describe('computeDownstreamState', () => {
  test('missing / drift / synced', () => {
    expect(computeDownstreamState('abc', null)).toBe('missing')
    expect(computeDownstreamState('abc', 'abd')).toBe('drift')
    expect(computeDownstreamState('abc', 'abc')).toBe('synced')
  })
})

describe('subscribers', () => {
  test('filters targets by subscription', () => {
    const targets = [
      { path: '/a', subscriptions: ['constitution'] },
      { path: '/b', subscriptions: ['other'] },
    ]
    expect(subscribers(targets, 'constitution').map((t) => t.path)).toEqual(['/a'])
  })
})

describe('distribute', () => {
  test('copies rule artifact to target', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'meta-cli-repo-'))
    const targetDir = mkdtempSync(join(tmpdir(), 'meta-cli-target-'))
    try {
      mkdirSync(join(repoRoot, 'rules/global'), { recursive: true })
      writeFileSync(join(repoRoot, 'rules/global/constitution.md'), '# Constitution\n')
      distribute(repoRoot, ruleAsset, { path: targetDir, subscriptions: ['constitution'] })
      expect(readFileSync(join(targetDir, '.claude/rules/constitution.md'), 'utf8')).toBe(
        '# Constitution\n',
      )
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
      rmSync(targetDir, { recursive: true, force: true })
    }
  })
  test('rejects non-rule assets', () => {
    expect(() =>
      distribute('/tmp', { ...ruleAsset, kind: 'template' }, { path: '/tmp', subscriptions: [] }),
    ).toThrow(/rule/)
  })
})

describe('downstreamStates', () => {
  test('subscribed target with no downstream copy → missing', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'meta-cli-repo-'))
    const targetA = mkdtempSync(join(tmpdir(), 'meta-cli-target-'))
    try {
      mkdirSync(join(repoRoot, 'rules/global'), { recursive: true })
      writeFileSync(join(repoRoot, 'rules/global/constitution.md'), '# Constitution\n')
      const targets = [{ path: targetA, subscriptions: ['constitution'] }]
      const result = downstreamStates(repoRoot, ruleAsset, targets)
      expect(result).toHaveLength(1)
      expect(result[0].state).toBe('missing')
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
      rmSync(targetA, { recursive: true, force: true })
    }
  })

  test('subscribed target with identical copy → synced', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'meta-cli-repo-'))
    const targetB = mkdtempSync(join(tmpdir(), 'meta-cli-target-'))
    try {
      const artifact = '# Constitution\n'
      mkdirSync(join(repoRoot, 'rules/global'), { recursive: true })
      writeFileSync(join(repoRoot, 'rules/global/constitution.md'), artifact)
      mkdirSync(join(targetB, '.claude/rules'), { recursive: true })
      writeFileSync(join(targetB, '.claude/rules/constitution.md'), artifact)
      const targets = [{ path: targetB, subscriptions: ['constitution'] }]
      const result = downstreamStates(repoRoot, ruleAsset, targets)
      expect(result).toHaveLength(1)
      expect(result[0].state).toBe('synced')
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
      rmSync(targetB, { recursive: true, force: true })
    }
  })

  test('subscribed target with differing copy → drift', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'meta-cli-repo-'))
    const targetC = mkdtempSync(join(tmpdir(), 'meta-cli-target-'))
    try {
      mkdirSync(join(repoRoot, 'rules/global'), { recursive: true })
      writeFileSync(join(repoRoot, 'rules/global/constitution.md'), '# Constitution v2\n')
      mkdirSync(join(targetC, '.claude/rules'), { recursive: true })
      writeFileSync(join(targetC, '.claude/rules/constitution.md'), '# Constitution v1\n')
      const targets = [{ path: targetC, subscriptions: ['constitution'] }]
      const result = downstreamStates(repoRoot, ruleAsset, targets)
      expect(result).toHaveLength(1)
      expect(result[0].state).toBe('drift')
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
      rmSync(targetC, { recursive: true, force: true })
    }
  })

  test('artifact file absent → all subscribers report missing', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'meta-cli-repo-'))
    const targetD = mkdtempSync(join(tmpdir(), 'meta-cli-target-'))
    try {
      mkdirSync(join(repoRoot, 'rules/global'), { recursive: true })
      mkdirSync(join(targetD, '.claude/rules'), { recursive: true })
      writeFileSync(join(targetD, '.claude/rules/constitution.md'), '# Constitution\n')
      const targets = [{ path: targetD, subscriptions: ['constitution'] }]
      const result = downstreamStates(repoRoot, ruleAsset, targets)
      expect(result).toHaveLength(1)
      expect(result[0].state).toBe('missing')
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
      rmSync(targetD, { recursive: true, force: true })
    }
  })

  test('non-subscribed targets excluded from result', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'meta-cli-repo-'))
    const targetE = mkdtempSync(join(tmpdir(), 'meta-cli-target-'))
    const targetF = mkdtempSync(join(tmpdir(), 'meta-cli-target-'))
    try {
      mkdirSync(join(repoRoot, 'rules/global'), { recursive: true })
      writeFileSync(join(repoRoot, 'rules/global/constitution.md'), '# Constitution\n')
      const targets = [
        { path: targetE, subscriptions: ['constitution'] },
        { path: targetF, subscriptions: ['other-rule'] },
      ]
      const result = downstreamStates(repoRoot, ruleAsset, targets)
      expect(result).toHaveLength(1)
      expect(result[0].target.path).toBe(targetE)
    } finally {
      rmSync(repoRoot, { recursive: true, force: true })
      rmSync(targetE, { recursive: true, force: true })
      rmSync(targetF, { recursive: true, force: true })
    }
  })
})
