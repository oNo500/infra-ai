import { describe, expect, test } from 'bun:test'
import { computeStatus } from '../src/core/status'

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
