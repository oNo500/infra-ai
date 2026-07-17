import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { planAssembly } from '../src/core/assemble'

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-asm-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  mkdirSync(join(dir, 'rules', 'global'), { recursive: true })
  mkdirSync(join(dir, 'rules', 'scoped'), { recursive: true })
  writeFileSync(join(dir, 'meta', 'tags.json'), JSON.stringify({ concern: { exclusive: false, values: { core: 'x', docs: 'x' } } }))
  writeFileSync(join(dir, 'meta', 'rules', 'constitution.md'), '---\nname: constitution\nstatus: ready\nscope: global\ntags: [core]\n---\nbody')
  writeFileSync(join(dir, 'meta', 'rules', 'markdown.md'), '---\nname: markdown\nstatus: ready\nscope: "**/*.md"\ntags: [docs]\n---\nbody')
  writeFileSync(join(dir, 'rules', 'global', 'constitution.md'), '# Constitution\n')
  writeFileSync(join(dir, 'rules', 'scoped', 'markdown.md'), '---\npaths:\n  - "**/*.md"\n---\n# Markdown\n')
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution', 'markdown'] } }))
  return dir
}

describe('planAssembly', () => {
  test('produces sorted copy plan with hashes', () => {
    const src = fixtureSource()
    const { items, violations } = planAssembly(src, 'demo')
    expect(violations).toEqual([])
    expect(items.map((i) => i.rule)).toEqual(['constitution', 'markdown'])
    expect(items[0]?.targetRelPath).toBe('.claude/rules/constitution.md')
    expect(items[0]?.hash).toHaveLength(64)
  })
  test('unknown profile throws with available names', () => {
    const src = fixtureSource()
    expect(() => planAssembly(src, 'nope')).toThrow("unknown profile 'nope' (available: demo)")
  })
  test('missing built artifact becomes a violation', () => {
    const src = fixtureSource()
    writeFileSync(join(src, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution', 'markdown', 'ghost'] } }))
    const { violations } = planAssembly(src, 'demo')
    expect(violations.some((v) => v.includes('ghost'))).toBe(true)
  })
})
