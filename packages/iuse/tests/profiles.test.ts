import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listProfiles } from '../src/core/profiles'

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-prof-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  mkdirSync(join(dir, 'rules', 'global'), { recursive: true })
  mkdirSync(join(dir, 'rules', 'scoped'), { recursive: true })
  writeFileSync(join(dir, 'meta', 'tags.json'), JSON.stringify({ concern: { exclusive: false, values: { core: 'x', docs: 'x' } } }))
  writeFileSync(join(dir, 'meta', 'rules', 'constitution.md'), '---\nname: constitution\nstatus: ready\ndescription: x\nscope: global\ntags: [core]\n---\nbody')
  writeFileSync(join(dir, 'meta', 'rules', 'markdown.md'), '---\nname: markdown\nstatus: ready\ndescription: x\nscope: "**/*.md"\ntags: [docs]\n---\nbody')
  writeFileSync(join(dir, 'rules', 'global', 'constitution.md'), '# Constitution\n')
  writeFileSync(join(dir, 'rules', 'scoped', 'markdown.md'), '---\npaths:\n  - "**/*.md"\n---\n# Markdown\n')
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({
    demo: { description: 'Demo profile', rules: ['constitution', 'markdown'] },
    minimal: { rules: ['constitution'] },
  }))
  return dir
}

describe('listProfiles', () => {
  test('lists profiles sorted with rules and descriptions', () => {
    const src = fixtureSource()
    const rows = listProfiles(src)
    const names = rows.map((r) => r.name)
    expect(names).toEqual(names.toSorted())
    expect(rows[0]?.rules.length).toBeGreaterThan(0)
  })
  test('missing description defaults to empty string', () => {
    const src = fixtureSource()
    const rows = listProfiles(src)
    const minimal = rows.find((r) => r.name === 'minimal')
    expect(minimal?.description).toBe('')
  })
  test('returns description when present', () => {
    const src = fixtureSource()
    const rows = listProfiles(src)
    const demo = rows.find((r) => r.name === 'demo')
    expect(demo?.description).toBe('Demo profile')
  })
})
