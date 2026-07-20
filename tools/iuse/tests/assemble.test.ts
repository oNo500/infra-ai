import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Catalog } from '../src/core/contract'
import { assembleRules, planAssembly } from '../src/core/assemble'

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-asm-'))
  mkdirSync(join(dir, 'rules'), { recursive: true })
  writeFileSync(join(dir, 'rules', 'constitution.md'), '# Constitution\n')
  // markdown.md carries baked paths frontmatter directly in the artifact --
  // the final install form file-scoped rules ship in.
  writeFileSync(join(dir, 'rules', 'markdown.md'), '---\npaths:\n  - "**/*.md"\n---\n\n# Markdown\n')
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution', 'markdown'] } }))
  const catalog: Catalog = {
    generatedAt: '2026-07-19T00:00:00Z',
    tags: {},
    rules: {
      constitution: { description: 'x', tags: ['core'], requires: [], path: 'rules/constitution.md', profiles: ['demo'] },
      markdown: { description: 'x', tags: ['docs'], requires: [], path: 'rules/markdown.md', profiles: ['demo'] },
    },
  }
  writeFileSync(join(dir, 'catalog.json'), JSON.stringify(catalog, null, 2))
  return dir
}

describe('planAssembly', () => {
  test('produces a sorted copy plan with hashes, copying artifact content verbatim including baked frontmatter', () => {
    const src = fixtureSource()
    const { items, violations } = planAssembly(src, 'demo')
    expect(violations).toEqual([])
    expect(items.map((i) => i.rule)).toEqual(['constitution', 'markdown'])
    expect(items[0]?.targetRelPath).toBe('.claude/rules/constitution.md')
    expect(items[0]?.hash).toHaveLength(64)
    expect(items[0]?.content).toBe('# Constitution\n')
    const markdown = items.find((i) => i.rule === 'markdown')
    expect(markdown?.content).toBe('---\npaths:\n  - "**/*.md"\n---\n\n# Markdown\n')
  })
  test('unknown profile throws with available names', () => {
    const src = fixtureSource()
    expect(() => planAssembly(src, 'nope')).toThrow("unknown profile 'nope' (available: demo)")
  })
  test('missing built artifact becomes a violation', () => {
    const src = fixtureSource()
    const catalog: Catalog = {
      generatedAt: '2026-07-19T00:00:00Z',
      tags: {},
      rules: {
        constitution: { description: 'x', tags: ['core'], requires: [], path: 'rules/constitution.md', profiles: ['demo'] },
        markdown: { description: 'x', tags: ['docs'], requires: [], path: 'rules/markdown.md', profiles: ['demo'] },
        ghost: { description: 'x', tags: [], requires: [], path: 'rules/ghost.md', profiles: ['demo'] },
      },
    }
    writeFileSync(join(src, 'catalog.json'), JSON.stringify(catalog, null, 2))
    writeFileSync(join(src, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution', 'markdown', 'ghost'] } }))
    const { violations } = planAssembly(src, 'demo')
    expect(violations.some((v) => v.includes('ghost') && v.includes('built artifact missing'))).toBe(true)
  })
  test('profile requires a rule not in the profile becomes a violation', () => {
    const src = fixtureSource()
    const catalog: Catalog = {
      generatedAt: '2026-07-19T00:00:00Z',
      tags: {},
      rules: {
        constitution: { description: 'x', tags: ['core'], requires: [], path: 'rules/constitution.md', profiles: ['demo'] },
        markdown: { description: 'x', tags: ['docs'], requires: ['constitution'], path: 'rules/markdown.md', profiles: ['demo'] },
        strict: { description: 'x', tags: [], requires: ['constitution'], path: 'rules/strict.md', profiles: ['demo'] },
      },
    }
    writeFileSync(join(src, 'catalog.json'), JSON.stringify(catalog, null, 2))
    writeFileSync(join(src, 'rules', 'strict.md'), '# Strict\n')
    writeFileSync(join(src, 'profiles.json'), JSON.stringify({ demo: { rules: ['markdown', 'strict'] } }))
    const { violations } = planAssembly(src, 'demo')
    expect(violations).toContain("profile demo: 'markdown' requires 'constitution' which is not in the profile")
    expect(violations).toContain("profile demo: 'strict' requires 'constitution' which is not in the profile")
  })
  test('profile missing constitution becomes a violation', () => {
    const src = fixtureSource()
    writeFileSync(join(src, 'profiles.json'), JSON.stringify({ demo: { rules: ['markdown'] } }))
    const { violations } = planAssembly(src, 'demo')
    expect(violations).toContain('profile demo: missing constitution')
  })
  test('profile member not in catalog becomes a violation', () => {
    const src = fixtureSource()
    writeFileSync(join(src, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution', 'ghost'] } }))
    const { violations } = planAssembly(src, 'demo')
    expect(violations).toContain("profile demo: unknown rule 'ghost'")
  })
  test('composition validation only checks the requested profile, not every profile in profiles.json', () => {
    const src = fixtureSource()
    writeFileSync(
      join(src, 'profiles.json'),
      JSON.stringify({
        demo: { rules: ['constitution', 'markdown'] },
        broken: { rules: ['ghost'] }, // unrelated profile with violations of its own
      }),
    )
    const { violations } = planAssembly(src, 'demo')
    expect(violations).toEqual([])
  })
  test('missing catalog.json throws with the imeta catalog hint', () => {
    const dir = mkdtempSync(join(tmpdir(), 'iuse-asm-nocatalog-'))
    writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution'] } }))
    expect(() => planAssembly(dir, 'demo')).toThrow(`${dir}: catalog.json missing, run 'imeta catalog' in the source`)
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
  test('rule not present in catalog.rules lands in missing', () => {
    const root = fixtureSource()
    const { items, missing } = assembleRules(root, ['constitution', 'not-in-catalog'])
    expect(items.map((i) => i.rule)).toEqual(['constitution'])
    expect(missing).toEqual(['not-in-catalog'])
  })
  test('missing catalog.json throws with the imeta catalog hint', () => {
    const dir = mkdtempSync(join(tmpdir(), 'iuse-asm-nocatalog-'))
    expect(() => assembleRules(dir, ['constitution'])).toThrow(`${dir}: catalog.json missing, run 'imeta catalog' in the source`)
  })
})
