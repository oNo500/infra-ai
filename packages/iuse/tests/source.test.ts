import { describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveSource } from '../src/core/source'

function localSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-src-'))
  writeFileSync(join(dir, 'profiles.json'), '{}')
  return dir
}

const fakeRun = (stdout: string, code = 0) => {
  let callCount = 0
  return async () => {
    callCount += 1
    return { code, stdout: callCount === 1 ? stdout : '', stderr: '' }
  }
}

describe('resolveSource', () => {
  test('explicit local path wins and records git HEAD', async () => {
    const dir = localSource()
    const ref = await resolveSource({
      explicit: dir, envRoot: '/nope', homeDefault: '/nope2', cacheDir: '/tmp',
      download: async () => ({}), run: fakeRun('abc123\n'),
    })
    expect(ref.root).toBe(dir)
    expect(ref.version).toEqual({ type: 'local', id: 'abc123' })
  })
  test('dirty worktree appends -dirty', async () => {
    const dir = localSource()
    let call = 0
    const run = async () => {
      call += 1
      return call === 1 ? { code: 0, stdout: 'abc123\n', stderr: '' } : { code: 0, stdout: ' M x\n', stderr: '' }
    }
    const ref = await resolveSource({ explicit: dir, homeDefault: '/n', cacheDir: '/t', download: async () => ({}), run })
    expect(ref.version.id).toBe('abc123-dirty')
  })
  test('missing profiles.json rejects local path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'iuse-bad-'))
    await expect(resolveSource({ explicit: dir, homeDefault: '/n', cacheDir: '/t', download: async () => ({}), run: fakeRun('') }))
      .rejects.toThrow('profiles.json not found')
  })
  test('gh: source downloads snapshot and records ref', async () => {
    const cache = mkdtempSync(join(tmpdir(), 'iuse-cache-'))
    const download = async (_input: string, opts: { dir: string }) => {
      mkdirSync(opts.dir, { recursive: true })
      writeFileSync(join(opts.dir, 'profiles.json'), '{}')
      return {}
    }
    const ref = await resolveSource({ explicit: 'gh:owner/repo#v2', homeDefault: '/n', cacheDir: cache, download, run: fakeRun('') })
    expect(ref.version).toEqual({ type: 'remote', id: 'v2' })
    expect(ref.root.startsWith(cache)).toBe(true)
  })
  test('env fallback then home default', async () => {
    const dir = localSource()
    const ref = await resolveSource({ envRoot: dir, homeDefault: '/nope', cacheDir: '/t', download: async () => ({}), run: fakeRun('h\n') })
    expect(ref.root).toBe(dir)
  })
})
