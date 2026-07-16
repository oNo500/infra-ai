import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sha256 } from '../src/core/io'
import type { MetaAsset } from '../src/core/meta'
import { adoptEntry, computeStatus, gatherFacts, lockKey } from '../src/core/status'

const lock = { metaHash: 'm1', artifactHash: 'a1', builtAt: '2026-07-11T00:00:00Z' }

describe('computeStatus', () => {
  test('stub wins regardless of other facts', () => {
    expect(
      computeStatus({ metaStatus: 'stub', metaHash: 'x', artifactHash: null, lock: null }),
    ).toBe('stub')
  })
  test('no artifact means unbuilt', () => {
    expect(
      computeStatus({ metaStatus: 'ready', metaHash: 'm1', artifactHash: null, lock: null }),
    ).toBe('unbuilt')
  })
  test('artifact without lock entry means untracked', () => {
    expect(
      computeStatus({ metaStatus: 'ready', metaHash: 'm1', artifactHash: 'a1', lock: null }),
    ).toBe('untracked')
  })
  test('artifact hash mismatch means dirty (checked before stale)', () => {
    expect(
      computeStatus({ metaStatus: 'ready', metaHash: 'm2', artifactHash: 'a2', lock }),
    ).toBe('dirty')
  })
  test('meta hash mismatch means stale', () => {
    expect(
      computeStatus({ metaStatus: 'ready', metaHash: 'm2', artifactHash: 'a1', lock }),
    ).toBe('stale')
  })
  test('all hashes match means synced', () => {
    expect(
      computeStatus({ metaStatus: 'ready', metaHash: 'm1', artifactHash: 'a1', lock }),
    ).toBe('synced')
  })
})

const ruleAsset: MetaAsset = {
  name: 'constitution',
  kind: 'rule',
  status: 'ready',
  scope: 'global',
  tags: [],
  requires: [],
  metaPath: 'meta/rules/constitution.md',
  artifactPath: 'rules/global/constitution.md',
}

describe('gatherFacts', () => {
  test('computes hashes from real files and resolves lock entry via lockKey', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      mkdirSync(join(root, 'meta/rules'), { recursive: true })
      mkdirSync(join(root, 'rules/global'), { recursive: true })
      const metaContent = '---\nname: constitution\nstatus: ready\n---\nbody\n'
      const artifactContent = '# Constitution\n'
      writeFileSync(join(root, 'meta/rules/constitution.md'), metaContent)
      writeFileSync(join(root, 'rules/global/constitution.md'), artifactContent)

      const noLockFacts = gatherFacts(root, ruleAsset, {})
      expect(noLockFacts.metaHash).toBe(sha256(metaContent))
      expect(noLockFacts.artifactHash).toBe(sha256(artifactContent))
      expect(noLockFacts.lock).toBeNull()

      const entry = {
        metaHash: sha256(metaContent),
        artifactHash: sha256(artifactContent),
        builtAt: '2026-07-11T00:00:00Z',
      }
      const hitFacts = gatherFacts(root, ruleAsset, { [lockKey(ruleAsset)]: entry })
      expect(hitFacts.lock).toEqual(entry)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('missing artifact yields null artifactHash', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      mkdirSync(join(root, 'meta/rules'), { recursive: true })
      writeFileSync(join(root, 'meta/rules/constitution.md'), '---\nname: constitution\n---\n')
      const facts = gatherFacts(root, ruleAsset, {})
      expect(facts.artifactHash).toBeNull()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('adoptEntry', () => {
  test('builds a lock entry shape from hashes and timestamp', () => {
    expect(adoptEntry('m1', 'a1', '2026-07-11T00:00:00Z')).toEqual({
      metaHash: 'm1',
      artifactHash: 'a1',
      builtAt: '2026-07-11T00:00:00Z',
    })
  })
})
