import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  RegistryError,
  loadLock,
  loadSkills,
  loadTargets,
  saveLock,
  saveTargets,
} from '../src/core/registry'

function tmpRoot(): string {
  return mkdtempSync(join(tmpdir(), 'meta-cli-'))
}

describe('targets registry', () => {
  test('missing file returns empty list', () => {
    const root = tmpRoot()
    try {
      expect(loadTargets(root)).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('save then load round-trips, file ends with newline', () => {
    const root = tmpRoot()
    try {
      const targets = [{ path: '/tmp/proj-a', subscriptions: ['constitution'] }]
      saveTargets(root, targets)
      expect(loadTargets(root)).toEqual(targets)
      expect(readFileSync(join(root, 'targets.json'), 'utf8').endsWith('\n')).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('lock registry', () => {
  test('missing file returns empty object; round-trips', () => {
    const root = tmpRoot()
    try {
      expect(loadLock(root)).toEqual({})
      const lock = {
        constitution: { metaHash: 'a', artifactHash: 'b', builtAt: '2026-07-11T00:00:00Z' },
      }
      saveLock(root, lock)
      expect(loadLock(root)).toEqual(lock)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('skills registry', () => {
  test('missing skills.json throws RegistryError', () => {
    const root = tmpRoot()
    try {
      expect(() => loadSkills(root)).toThrow(RegistryError)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('invalid JSON throws RegistryError with file path', () => {
    const root = tmpRoot()
    try {
      writeFileSync(join(root, 'skills.json'), '{ not json')
      expect(() => loadSkills(root)).toThrow(/skills\.json/u)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
