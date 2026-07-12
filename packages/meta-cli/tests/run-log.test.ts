import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRunLog } from '../src/core/run-log'

const NOW = '2026-07-12T09:04:59.969Z'

describe('createRunLog', () => {
  test('writes events as JSONL with runId and action bindings', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      const log = createRunLog(root, 'build', { positionals: ['commit-lite'], flags: {} }, NOW)
      log.event('start', { params: { positionals: ['commit-lite'], flags: {} } })
      log.event('result', { ok: true })
      log.close()
      expect(log.path).toBe(join(root, '.imeta/logs/20260712T090459969Z-build-commit-lite.jsonl'))
      const lines = readFileSync(log.path, 'utf8').trim().split('\n')
      expect(lines).toHaveLength(2)
      const first = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>
      expect(first.step).toBe('start')
      expect(first.action).toBe('build')
      expect(first.runId).toBe('20260712T090459969Z-build-commit-lite')
      const second = JSON.parse(lines[1] ?? '{}') as Record<string, unknown>
      expect(second.step).toBe('result')
      expect(second.ok).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('subject falls back to stale flag then run; colon in action id becomes dash', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      const stale = createRunLog(root, 'build', { positionals: [], flags: { stale: true } }, NOW)
      expect(stale.path.endsWith('-build-stale.jsonl')).toBe(true)
      const update = createRunLog(root, 'skills:update', { positionals: [], flags: {} }, NOW)
      expect(update.path.endsWith('-skills-update-run.jsonl')).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('retention keeps only the newest N files', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      const dir = join(root, '.imeta/logs')
      mkdirSync(dir, { recursive: true })
      for (const stamp of ['20260701T000000000Z', '20260702T000000000Z', '20260703T000000000Z', '20260704T000000000Z']) {
        writeFileSync(join(dir, `${stamp}-build-x.jsonl`), '{}\n')
      }
      const log = createRunLog(root, 'adopt', { positionals: ['foo'], flags: {} }, NOW, 3)
      log.close()
      const files = readdirSync(dir).toSorted()
      expect(files).toHaveLength(3)
      expect(files[0]).toBe('20260703T000000000Z-build-x.jsonl')
      expect(files[2]?.endsWith('-adopt-foo.jsonl')).toBe(true)
      expect(existsSync(join(dir, '20260701T000000000Z-build-x.jsonl'))).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
