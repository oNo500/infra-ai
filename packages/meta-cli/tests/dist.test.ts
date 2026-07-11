import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { MetaAsset } from '../src/core/meta'
import {
  computeDownstreamState,
  distribute,
  downstreamPath,
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
