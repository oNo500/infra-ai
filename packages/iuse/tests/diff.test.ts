import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { diffReport } from '../src/core/diff'
import { runInit } from '../src/core/init'
import type { IuseContext } from '../src/core/init'
import { loadDownstreamLock, saveDownstreamLock } from '../src/core/manifest'

/**
 * Recursive full-content snapshot of a directory tree, keyed by path relative
 * to `dir` -- asserts global mode never mutates $HOME (read-only invariant).
 */
function snapshotDir(dir: string): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (current: string): void => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        walk(full)
        continue
      }
      out[relative(dir, full)] = readFileSync(full, 'utf8')
    }
  }
  walk(dir)
  return out
}

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-diff-src-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  mkdirSync(join(dir, 'rules'), { recursive: true })
  mkdirSync(join(dir, 'templates'), { recursive: true })
  writeFileSync(join(dir, 'meta', 'tags.json'), JSON.stringify({ concern: { exclusive: false, values: { core: 'x' } } }))
  writeFileSync(
    join(dir, 'meta', 'rules', 'constitution.md'),
    '---\nname: constitution\nstatus: ready\ndescription: x\nscope: global\ntags: [core]\n---\nbody',
  )
  writeFileSync(join(dir, 'rules', 'constitution.md'), '# Constitution\n')
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution'] } }))
  writeFileSync(join(dir, 'globals.json'), JSON.stringify({ rules: ['constitution'] }))
  writeFileSync(join(dir, 'templates', 'settings.json'), JSON.stringify({ model: 'sonnet' }))
  writeFileSync(join(dir, 'templates', 'architecture.md'), '# [PROJECT_NAME] - Architecture\n\nbody\n')
  writeFileSync(join(dir, 'templates', 'claude-md.md'), '# [PROJECT_NAME]\n\nbody\n')
  mkdirSync(join(dir, 'meta', 'prompts'), { recursive: true })
  writeFileSync(join(dir, 'meta', 'prompts', 'template-instantiate.md'), '# contract\n')
  return dir
}

function addRule(source: string, name: string, ruleBody: string, tags: string[] = ['core']): void {
  writeFileSync(
    join(source, 'meta', 'rules', `${name}.md`),
    `---\nname: ${name}\nstatus: ready\ndescription: x\nscope: global\ntags: [${tags.join(', ')}]\n---\nbody`,
  )
  writeFileSync(join(source, 'rules', `${name}.md`), ruleBody)
}

function setProfileRules(source: string, rules: string[]): void {
  writeFileSync(join(source, 'profiles.json'), JSON.stringify({ demo: { rules } }))
}

function fakeClaudeWriting(): IuseContext['claude'] {
  return async (opts) => {
    const match = /(?:Write|Edit)\((.+)\)/u.exec(opts.allowedTools)
    const rel = match?.[1]
    if (rel === undefined) throw new Error('no target file in allowedTools')
    const targetFile = join(opts.repoRoot, rel)
    writeFileSync(targetFile, targetFile.endsWith('architecture.md') ? '# demo - Architecture\n\nbody\n' : '# demo\n\nbody\n')
    return { code: 0, timedOut: false, stderr: '' }
  }
}

function ctxWith(now: () => string = () => '2026-07-18T00:00:00Z'): IuseContext {
  return {
    download: async () => ({}),
    run: async () => ({ code: 0, stdout: 'head1\n', stderr: '' }),
    claude: fakeClaudeWriting(),
    now,
    env: {},
    home: '/nope',
    cacheDir: '/tmp/iuse-cache',
  }
}

async function initTarget(source: string): Promise<string> {
  const target = mkdtempSync(join(tmpdir(), 'iuse-diff-tgt-'))
  const result = await runInit(ctxWith(), { source, profile: 'demo', target, force: false })
  if (!result.ok) throw new Error(`fixture init failed: ${result.message}`)
  return target
}

describe('diffReport', () => {
  test('no lock at target fails pointing at init', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-diff-tgt-'))

    const result = await diffReport(ctxWith(), { source, target })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('iuse init')
    expect(result.diffs).toEqual([])
    expect(result.exitCode).toBe(1)
  })

  test('source resolution failure returns clean fail', async () => {
    const badSource = mkdtempSync(join(tmpdir(), 'iuse-diff-badsrc-'))
    const target = await initTarget(fixtureSource())

    const result = await diffReport(ctxWith(), { source: badSource, target })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('profiles.json not found')
    expect(result.diffs).toEqual([])
    expect(result.exitCode).toBe(1)
  })

  test('no differences -> empty diffs, exit 0', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)

    const result = await diffReport(ctxWith(), { source, target })

    expect(result.ok).toBe(true)
    expect(result.diffs).toEqual([])
    expect(result.exitCode).toBe(0)
  })

  test('summary mode: differing rule reports additions/deletions with no patch, exit 1', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(source, 'rules', 'constitution.md'), '# Constitution\n\nline a\nline b\n')

    const result = await diffReport(ctxWith(), { source, target })

    expect(result.ok).toBe(true)
    expect(result.diffs).toEqual([
      { rule: 'constitution', state: 'outdated', additions: 3, deletions: 0 },
    ])
    expect(result.diffs[0]?.patch).toBeUndefined()
    expect(result.exitCode).toBe(1)
  })

  test('summary mode omits excluded rules', async () => {
    const source = fixtureSource()
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])
    const target = await initTarget(source)
    const lock = loadDownstreamLock(target)
    if (lock === null) throw new Error('fixture lock missing')
    const { extra: _extra, ...restRules } = lock.rules
    saveDownstreamLock(target, { ...lock, rules: restRules, excluded: ['extra'] })
    writeFileSync(join(source, 'rules', 'extra.md'), '# Extra\n\nchanged upstream\n')

    const result = await diffReport(ctxWith(), { source, target })

    expect(result.ok).toBe(true)
    expect(result.diffs.map((d) => d.rule)).not.toContain('extra')
    expect(result.exitCode).toBe(0)
  })

  test('named rule: unknown name fails listing known rules', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)

    const result = await diffReport(ctxWith(), { source, target, rule: 'ghost' })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('ghost')
    expect(result.message).toContain('constitution')
    expect(result.diffs).toEqual([])
    expect(result.exitCode).toBe(1)
  })

  test('named rule: a prototype-property name like "toString" is not mistaken for a known rule', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)

    const result = await diffReport(ctxWith(), { source, target, rule: 'toString' })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('toString')
    expect(result.message).toContain('constitution')
    expect(result.exitCode).toBe(1)
  })

  test('named rule: identical content yields a zero-count synced entry with a patch header present, exit 0', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)

    const result = await diffReport(ctxWith(), { source, target, rule: 'constitution' })

    expect(result.ok).toBe(true)
    expect(result.diffs).toHaveLength(1)
    expect(result.diffs[0]?.state).toBe('synced')
    expect(result.diffs[0]?.additions).toBe(0)
    expect(result.diffs[0]?.deletions).toBe(0)
    expect(result.exitCode).toBe(0)
  })

  test('named rule: exact added/removed line counts from a fixed two-text fixture', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    // local (baseline) content is '# Constitution\n' (one line).
    // source moves to a 3-line text: this replaces line 1 and adds 2 new lines.
    writeFileSync(join(source, 'rules', 'constitution.md'), 'line one\nline two\nline three\n')

    const result = await diffReport(ctxWith(), { source, target, rule: 'constitution' })

    expect(result.ok).toBe(true)
    expect(result.diffs).toHaveLength(1)
    const entry = result.diffs[0]
    if (entry === undefined) throw new Error('expected a diff entry')
    expect(entry.state).toBe('outdated')
    expect(entry.deletions).toBe(1)
    expect(entry.additions).toBe(3)
    expect(entry.patch).toContain('+line one')
    expect(entry.patch).toContain('+line two')
    expect(entry.patch).toContain('+line three')
    expect(entry.patch).toContain('-# Constitution')
    expect(entry.patch).toContain('constitution (local)')
    expect(entry.patch).toContain('constitution (source)')
    expect(result.exitCode).toBe(1)
  })

  test('named rule: local file missing diffs against empty string and reports state missing, all additions', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    rmSync(join(target, '.claude/rules/constitution.md'))

    const result = await diffReport(ctxWith(), { source, target, rule: 'constitution' })

    expect(result.ok).toBe(true)
    expect(result.diffs).toHaveLength(1)
    const entry = result.diffs[0]
    if (entry === undefined) throw new Error('expected a diff entry')
    expect(entry.state).toBe('missing')
    expect(entry.deletions).toBe(0)
    expect(entry.additions).toBe(1)
    expect(entry.patch).toContain('+# Constitution')
    expect(result.exitCode).toBe(1)
  })

  test('named rule: excluded rule can be diffed directly even though bare run omits it', async () => {
    const source = fixtureSource()
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])
    const target = await initTarget(source)
    const lock = loadDownstreamLock(target)
    if (lock === null) throw new Error('fixture lock missing')
    const { extra: _extra, ...restRules } = lock.rules
    saveDownstreamLock(target, { ...lock, rules: restRules, excluded: ['extra'] })
    writeFileSync(join(source, 'rules', 'extra.md'), '# Extra\n\nchanged upstream\n')

    const result = await diffReport(ctxWith(), { source, target, rule: 'extra' })

    expect(result.ok).toBe(true)
    expect(result.diffs).toHaveLength(1)
    expect(result.diffs[0]?.rule).toBe('extra')
    expect(result.diffs[0]?.patch).toBeDefined()
    expect(result.exitCode).toBe(1)
  })

  test('named rule not in lock.rules nor excluded fails listing known rules', async () => {
    const source = fixtureSource()
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])
    const target = await initTarget(fixtureSource())

    const result = await diffReport(ctxWith(), { source, target, rule: 'extra' })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('extra')
    expect(result.message).toContain('constitution')
    expect(result.diffs).toEqual([])
    expect(result.exitCode).toBe(1)
  })

  test('diff no longer runs composition validation; a bogus profile rule unrelated to lock.rules does not fail the report', async () => {
    // diff works off lock.rules (the installed set), not the seed profile --
    // mirrors statusReport's SSoT-lock model. A profile mutation that never
    // touches an installed rule must not surface as a diff failure.
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(source, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution', 'ghost'] } }))

    const result = await diffReport(ctxWith(), { source, target })

    expect(result.ok).toBe(true)
    expect(result.diffs).toEqual([])
    expect(result.exitCode).toBe(0)
  })

  test('a locked rule whose built artifact is missing at the source surfaces as an assembly violation', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    rmSync(join(source, 'rules', 'constitution.md'))

    const result = await diffReport(ctxWith(), { source, target })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('constitution')
    expect(result.message).toContain('built artifact missing')
    expect(result.diffs).toEqual([])
    expect(result.exitCode).toBe(1)
  })

  test('rules-only target (profile "-") diffs cleanly without consulting profiles.json', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-diff-tgt-'))
    const initResult = await runInit(ctxWith(), { source, rules: ['constitution'], profile: '-', target, force: false })
    if (!initResult.ok) throw new Error(`fixture init failed: ${initResult.message}`)

    const clean = await diffReport(ctxWith(), { source, target })
    expect(clean.ok).toBe(true)
    expect(clean.diffs).toEqual([])
    expect(clean.exitCode).toBe(0)

    writeFileSync(join(source, 'rules', 'constitution.md'), '# Constitution\n\nline a\n')

    const result = await diffReport(ctxWith(), { source, target })

    expect(result.ok).toBe(true)
    expect(result.diffs).toEqual([
      { rule: 'constitution', state: 'outdated', additions: 2, deletions: 0 },
    ])
    expect(result.exitCode).toBe(1)
  })

  test('global diff: declared set from globals.json, differs state, home untouched', async () => {
    const source = fixtureSource()
    const fakeHome = mkdtempSync(join(tmpdir(), 'iuse-diff-home-'))
    mkdirSync(join(fakeHome, '.claude', 'rules'), { recursive: true })
    writeFileSync(join(fakeHome, '.claude', 'rules', 'constitution.md'), '# Constitution\n\nlocally edited\n')
    const before = snapshotDir(fakeHome)

    const result = await diffReport(ctxWith(), { source, target: fakeHome, global: true })

    expect(result.ok).toBe(true)
    expect(result.diffs[0]?.rule).toBe('constitution')
    expect(result.diffs[0]?.state).toBe('differs')
    expect(result.exitCode).toBe(1)
    expect(snapshotDir(fakeHome)).toEqual(before)
  })

  test('global diff --rule unknown name lists declared rules', async () => {
    const source = fixtureSource()
    const fakeHome = mkdtempSync(join(tmpdir(), 'iuse-diff-home-'))
    mkdirSync(join(fakeHome, '.claude', 'rules'), { recursive: true })

    const result = await diffReport(ctxWith(), { source, target: fakeHome, rule: 'ghost', global: true })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('constitution')
  })

  test('globals.json declares a rule absent from the source fails fast', async () => {
    const source = fixtureSource()
    writeFileSync(join(source, 'globals.json'), JSON.stringify({ rules: ['constitution', 'ghost'] }))
    const fakeHome = mkdtempSync(join(tmpdir(), 'iuse-diff-home-'))
    mkdirSync(join(fakeHome, '.claude', 'rules'), { recursive: true })

    const result = await diffReport(ctxWith(), { source, target: fakeHome, global: true })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('ghost')
    expect(result.message).toContain('globals.json')
    expect(result.diffs).toEqual([])
    expect(result.exitCode).toBe(1)
  })
})
