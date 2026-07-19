import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assembleRules, planAssembly } from '../src/core/assemble'

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-asm-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  mkdirSync(join(dir, 'rules'), { recursive: true })
  writeFileSync(join(dir, 'meta', 'tags.json'), JSON.stringify({ concern: { exclusive: false, values: { core: 'x', docs: 'x' } } }))
  writeFileSync(join(dir, 'meta', 'rules', 'constitution.md'), '---\nname: constitution\nstatus: ready\ndescription: x\nscope: global\ntags: [core]\n---\nbody')
  writeFileSync(join(dir, 'meta', 'rules', 'markdown.md'), '---\nname: markdown\nstatus: ready\ndescription: x\nscope: "**/*.md"\ntags: [docs]\n---\nbody')
  writeFileSync(join(dir, 'rules', 'constitution.md'), '# Constitution\n')
  writeFileSync(join(dir, 'rules', 'markdown.md'), '# Markdown\n')
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
  test('scoped rule content is rendered with paths frontmatter', () => {
    const src = fixtureSource()
    const { items } = planAssembly(src, 'demo')
    const markdown = items.find((i) => i.rule === 'markdown')
    expect(markdown?.content).toBe('---\npaths:\n  - "**/*.md"\n---\n\n# Markdown\n')
    const constitution = items.find((i) => i.rule === 'constitution')
    expect(constitution?.content).toBe('# Constitution\n')
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

describe('assembleRules', () => {
  test('resolves explicit names; unknown names land in missing', () => {
    const root = fixtureSource() // 含 constitution
    const { items, missing, violations } = assembleRules(root, ['constitution', 'ghost'])
    expect(items.map((i) => i.rule)).toEqual(['constitution'])
    expect(missing).toEqual(['ghost'])
    expect(violations).toEqual([])
  })
})
