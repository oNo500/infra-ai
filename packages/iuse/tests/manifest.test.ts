import { describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { computeDrift, loadDownstreamLock, saveDownstreamLock } from '../src/core/manifest'

describe('computeDrift', () => {
  test('all equal -> synced', () => expect(computeDrift('a', 'a', 'a')).toBe('synced'))
  test('local differs from baseline -> modified (regardless of source)', () => {
    expect(computeDrift('x', 'a', 'a')).toBe('modified')
    expect(computeDrift('x', 'a', 'b')).toBe('modified')
  })
  test('local matches baseline, source moved -> outdated', () => expect(computeDrift('a', 'a', 'b')).toBe('outdated'))
  test('source retired the rule -> outdated', () => expect(computeDrift('a', 'a', null)).toBe('outdated'))
  test('local copy deleted -> missing', () => expect(computeDrift(null, 'a', 'a')).toBe('missing'))
})

test('lock roundtrip and null on absence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-lock-'))
  expect(loadDownstreamLock(dir)).toBeNull()
  const lock = {
    source: { type: 'local' as const, id: 'abc', locator: '/src' },
    profile: 'python-cli',
    appliedAt: '2026-07-17T00:00:00Z',
    rules: { constitution: 'h1' },
    templates: ['architecture', 'claude-md'],
  }
  saveDownstreamLock(dir, lock)
  expect(loadDownstreamLock(dir)).toEqual(lock)
})
