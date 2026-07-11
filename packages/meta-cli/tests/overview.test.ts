import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadOverview } from '../src/core/overview'

describe('loadOverview', () => {
  test('combines status and downstream summary', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    const target = mkdtempSync(join(tmpdir(), 'meta-cli-target-'))
    try {
      mkdirSync(join(root, 'meta/rules'), { recursive: true })
      mkdirSync(join(root, 'rules/global'), { recursive: true })
      writeFileSync(
        join(root, 'meta/rules/constitution.md'),
        '---\nname: constitution\ntarget: rule\nstatus: ready\nscope: global\n---\n',
      )
      writeFileSync(join(root, 'rules/global/constitution.md'), '# C\n')
      writeFileSync(
        join(root, 'targets.json'),
        `${JSON.stringify([{ path: target, subscriptions: ['constitution'] }])}\n`,
      )
      const rows = loadOverview(root)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.status).toBe('untracked')
      expect(rows[0]?.downstream).toEqual({ synced: 0, drift: 0, missing: 1 })
      expect(rows[0]?.targets).toEqual([{ path: target, state: 'missing' }])
    } finally {
      rmSync(root, { recursive: true, force: true })
      rmSync(target, { recursive: true, force: true })
    }
  })
})
