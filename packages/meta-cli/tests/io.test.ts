import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readTextIfExists, sha256, writeFileAtomic } from '../src/core/io'

describe('sha256', () => {
  test('known vector', () => {
    expect(sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})

describe('readTextIfExists', () => {
  test('missing file returns null', () => {
    expect(readTextIfExists('/nonexistent/path/x.md')).toBeNull()
  })
})

describe('writeFileAtomic', () => {
  test('writes content, creates parent dirs, leaves no tmp file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'meta-cli-'))
    try {
      const target = join(dir, 'sub', 'a.json')
      writeFileAtomic(target, '{"x":1}\n')
      expect(readFileSync(target, 'utf8')).toBe('{"x":1}\n')
      expect(readdirSync(join(dir, 'sub'))).toEqual(['a.json'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
