import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CommandRunner } from '../src/core/io'
import type { SkillEntry } from '../src/core/registry'
import {
  checkMirrors,
  checkSkillsLedger,
  fixSkillsLedger,
  listInstalledSkills,
  officialRecommendations,
  updateMirror,
} from '../src/core/skills-sync'

function repoWith(skillDirs: Record<string, string>, ledger: SkillEntry[]): string {
  const root = mkdtempSync(join(tmpdir(), 'meta-cli-'))
  writeFileSync(join(root, 'skills.json'), `${JSON.stringify(ledger, null, 2)}\n`)
  for (const [dir, fmName] of Object.entries(skillDirs)) {
    mkdirSync(join(root, 'skills', dir), { recursive: true })
    writeFileSync(join(root, 'skills', dir, 'SKILL.md'), `---\nname: ${fmName}\n---\n`)
  }
  return root
}

describe('checkSkillsLedger', () => {
  test('reports name mismatch and unledgered dirs', () => {
    const root = repoWith({ good: 'good', bad: 'other', extra: 'extra' }, [
      { name: 'good', source: 'custom' },
      { name: 'bad', source: 'custom' },
    ])
    try {
      const issues = checkSkillsLedger(root)
      expect(issues).toEqual([
        { dir: 'bad', kind: 'name-mismatch', detail: "frontmatter name 'other' != directory name" },
        { dir: 'extra', kind: 'unledgered', detail: 'missing from skills.json' },
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('fixSkillsLedger', () => {
  test('adds unledgered as custom, keeps mismatch as issue', () => {
    const root = repoWith({ bad: 'other', extra: 'extra' }, [{ name: 'bad', source: 'custom' }])
    try {
      const result = fixSkillsLedger(root)
      expect(result.added).toEqual(['extra'])
      expect(result.issues.map((i) => i.kind)).toEqual(['name-mismatch'])
      const ledger = JSON.parse(readFileSync(join(root, 'skills.json'), 'utf8')) as SkillEntry[]
      expect(ledger.some((s) => s.name === 'extra' && s.source === 'custom')).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('checkMirrors', () => {
  test('flags outdated mirror via injected gh runner', async () => {
    const skills: SkillEntry[] = [
      { name: 'drawio', source: 'mirror', repo: 'r/x', path: 'p', commit: 'old' },
      { name: 'custom-one', source: 'custom' },
    ]
    const run: CommandRunner = async () => ({ code: 0, stdout: 'new\n', stderr: '' })
    const statuses = await checkMirrors(skills, run)
    expect(statuses).toEqual([
      { name: 'drawio', localCommit: 'old', remoteCommit: 'new', outdated: true },
    ])
  })
})

describe('updateMirror', () => {
  test('runs giget and rewrites ledger entry', async () => {
    const root = repoWith({}, [
      { name: 'drawio', source: 'mirror', repo: 'r/x', path: 'p', commit: 'old', updated: '2026-07-04' },
    ])
    const calls: string[][] = []
    const run: CommandRunner = async (cmd, args) => {
      calls.push([cmd, ...args])
      return { code: 0, stdout: '', stderr: '' }
    }
    try {
      await updateMirror(
        root,
        { name: 'drawio', localCommit: 'old', remoteCommit: 'new', outdated: true },
        run,
        '2026-07-11',
      )
      expect(calls[0]?.[0]).toBe('pnpx')
      const ledger = JSON.parse(readFileSync(join(root, 'skills.json'), 'utf8')) as SkillEntry[]
      expect(ledger[0]?.commit).toBe('new')
      expect(ledger[0]?.updated).toBe('2026-07-11')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('officialRecommendations', () => {
  test('filters to official source, preserves ledger order', () => {
    const skills: SkillEntry[] = [
      { name: 'custom-one', source: 'custom' },
      { name: 'official-a', source: 'official', repo: 'org/a' },
      { name: 'mirror-one', source: 'mirror', repo: 'org/m', path: 'p', commit: 'c' },
      { name: 'official-b', source: 'official', repo: 'org/b' },
    ]
    expect(officialRecommendations(skills)).toEqual([
      { name: 'official-a', repo: 'org/a' },
      { name: 'official-b', repo: 'org/b' },
    ])
  })

  test('defaults repo to empty string when missing', () => {
    const skills: SkillEntry[] = [{ name: 'official-no-repo', source: 'official' }]
    expect(officialRecommendations(skills)).toEqual([{ name: 'official-no-repo', repo: '' }])
  })
})

describe('listInstalledSkills', () => {
  test('splits stdout into trimmed non-empty lines on success', async () => {
    const run: CommandRunner = async () => ({
      code: 0,
      stdout: '  foo  \n\nbar\n   \nbaz\n',
      stderr: '',
    })
    const lines = await listInstalledSkills(run)
    expect(lines).toEqual(['foo', 'bar', 'baz'])
  })

  test('throws with stderr on non-zero exit', async () => {
    const run: CommandRunner = async () => ({ code: 1, stdout: '', stderr: 'boom' })
    await expect(listInstalledSkills(run)).rejects.toThrow('pnpx skills ls failed: boom')
  })
})
