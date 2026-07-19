import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { globalsViolations, loadGlobals } from '../src/core/globals'

function repoWith(rules: { name: string; status: string }[], globals?: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'imeta-globals-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  for (const r of rules) {
    writeFileSync(
      join(dir, 'meta', 'rules', `${r.name}.md`),
      `---\nname: ${r.name}\nstatus: ${r.status}\ndescription: x\nscope: global\ntags: [core]\n---\nbody`,
    )
  }
  if (globals !== undefined) writeFileSync(join(dir, 'globals.json'), JSON.stringify(globals))
  return dir
}

describe('globals', () => {
  test('loadGlobals: missing file null; well-formed parses; bad shape throws', () => {
    expect(loadGlobals(repoWith([]))).toBeNull()
    expect(loadGlobals(repoWith([], { rules: ['markdown'] }))).toEqual({ rules: ['markdown'] })
    expect(() => loadGlobals(repoWith([], { rules: 'markdown' }))).toThrow('globals.json')
  })

  test('globalsViolations: absent ok; unknown and non-ready rules flagged', () => {
    expect(globalsViolations(repoWith([{ name: 'a', status: 'ready' }]))).toEqual([])
    const repo = repoWith(
      [{ name: 'a', status: 'ready' }, { name: 'b', status: 'stub' }],
      { rules: ['a', 'b', 'ghost'] },
    )
    const violations = globalsViolations(repo)
    expect(violations).toContain("globals.json: rule 'b' is not ready")
    expect(violations).toContain("globals.json: unknown rule 'ghost'")
    expect(violations.some((v) => v.includes("'a'"))).toBe(false)
  })
})
