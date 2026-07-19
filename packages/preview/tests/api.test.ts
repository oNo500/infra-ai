import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assetPayload, assetsPayload } from '@/api'

function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'preview-'))
  writeFileSync(join(root, 'skills.json'), '[]\n')
  mkdirSync(join(root, 'meta/rules'), { recursive: true })
  writeFileSync(
    join(root, 'meta/rules/foo.md'),
    '---\nname: foo\nstatus: ready\nscope: global\n---\nintent\n',
  )
  mkdirSync(join(root, 'rules'), { recursive: true })
  writeFileSync(join(root, 'rules/foo.md'), '# foo artifact\n')
  return root
}

describe('preview api payloads', () => {
  test('assetsPayload lists assets with status', () => {
    const root = fixtureRepo()
    try {
      const list = assetsPayload(root)
      expect(list).toHaveLength(1)
      expect(list[0]).toEqual({ name: 'foo', kind: 'rule', status: 'untracked' })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
  test('assetPayload returns both documents; unknown name returns null; missing artifact is null', () => {
    const root = fixtureRepo()
    try {
      const detail = assetPayload(root, 'foo')
      expect(detail?.meta).toContain('intent')
      expect(detail?.artifact).toContain('# foo artifact')
      expect(detail?.metaPath).toBe('meta/rules/foo.md')
      expect(assetPayload(root, 'nope')).toBeNull()
      rmSync(join(root, 'rules/foo.md'))
      expect(assetPayload(root, 'foo')?.artifact).toBeNull()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
