import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadOverview } from '../src/core/overview'

describe('loadOverview', () => {
  test('combines asset and reconcile status', () => {
    const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      mkdirSync(join(root, 'meta/rules'), { recursive: true })
      mkdirSync(join(root, 'rules'), { recursive: true })
      writeFileSync(
        join(root, 'meta/rules/constitution.md'),
        '---\nname: constitution\ntarget: rule\nstatus: ready\nscope: global\n---\n',
      )
      writeFileSync(join(root, 'rules/constitution.md'), '# C\n')
      const rows = loadOverview(root)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.status).toBe('untracked')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
