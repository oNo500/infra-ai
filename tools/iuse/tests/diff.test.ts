import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Catalog } from '../src/core/contract'
import { diffReport } from '../src/core/diff'
import { runInit } from '../src/core/init'
import type { IuseContext } from '../src/core/init'
import { loadDownstreamLock, saveDownstreamLock } from '../src/core/manifest'

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-diff-src-'))
  mkdirSync(join(dir, 'rules'), { recursive: true })
  mkdirSync(join(dir, 'templates'), { recursive: true })
  writeFileSync(join(dir, 'rules', 'constitution.md'), '# Constitution\n')
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution'] } }))
  writeFileSync(join(dir, 'templates', 'settings.json'), JSON.stringify({ model: 'sonnet' }))
  writeFileSync(join(dir, 'templates', 'architecture.md'), '# [PROJECT_NAME] - Architecture\n\nbody\n')
  writeFileSync(join(dir, 'templates', 'claude-md.md'), '# [PROJECT_NAME]\n\nbody\n')
  writeFileSync(join(dir, 'templates', 'template-instantiate.md'), '# contract\n')
  const catalog: Catalog = {
    generatedAt: '2026-07-18T00:00:00Z',
    tags: { concern: { exclusive: false, values: { core: 'x' } } },
    rules: {
      constitution: { description: 'x', tags: ['core'], requires: [], path: 'rules/constitution.md', profiles: ['demo'] },
    },
  }
  writeFileSync(join(dir, 'catalog.json'), JSON.stringify(catalog, null, 2))
  return dir
}

function addRule(source: string, name: string, ruleBody: string, tags: string[] = ['core']): void {
  writeFileSync(join(source, 'rules', `${name}.md`), ruleBody)
  const catalog = JSON.parse(readFileSync(join(source, 'catalog.json'), 'utf8')) as Catalog
  catalog.rules[name] = { description: 'x', tags, requires: [], path: `rules/${name}.md`, profiles: ['demo'] }
  writeFileSync(join(source, 'catalog.json'), JSON.stringify(catalog, null, 2))
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

describe('diffReport error paths', () => {
  test('no lock, bad source, and named-rule-not-found all fail cleanly with empty diffs and exitCode 1', async () => {
    const source = fixtureSource()

    const noLock = await diffReport(ctxWith(), { source, target: mkdtempSync(join(tmpdir(), 'iuse-diff-tgt-')) })
    expect(noLock.ok).toBe(false)
    expect(noLock.message).toContain('iuse init')
    expect(noLock.diffs).toEqual([])
    expect(noLock.exitCode).toBe(1)

    const target = await initTarget(source)
    const badSource = mkdtempSync(join(tmpdir(), 'iuse-diff-badsrc-'))
    const badSourceResult = await diffReport(ctxWith(), { source: badSource, target })
    expect(badSourceResult.ok).toBe(false)
    expect(badSourceResult.message).toContain('profiles.json not found')
    expect(badSourceResult.diffs).toEqual([])

    // A prototype-property-shaped name ('toString') must not be mistaken for a known rule.
    const unknownRule = await diffReport(ctxWith(), { source, target, rule: 'toString' })
    expect(unknownRule.ok).toBe(false)
    expect(unknownRule.message).toContain('toString')
    expect(unknownRule.message).toContain('constitution')
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
})

describe('diffReport summary mode (no --rule)', () => {
  test('no differences -> empty diffs, exit 0; a real diff reports additions/deletions with no patch, exit 1', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)

    const clean = await diffReport(ctxWith(), { source, target })
    expect(clean.ok).toBe(true)
    expect(clean.diffs).toEqual([])
    expect(clean.exitCode).toBe(0)

    writeFileSync(join(source, 'rules', 'constitution.md'), '# Constitution\n\nline a\nline b\n')
    const outdated = await diffReport(ctxWith(), { source, target })
    expect(outdated.ok).toBe(true)
    expect(outdated.diffs).toEqual([{ rule: 'constitution', state: 'outdated', additions: 3, deletions: 0 }])
    expect(outdated.diffs[0]?.patch).toBeUndefined()
    expect(outdated.exitCode).toBe(1)
  })

  test('omits excluded rules from the summary and from the exit-code calculation', async () => {
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

  test('diff no longer runs composition validation; a bogus profile rule unrelated to lock.rules does not surface as a diff', async () => {
    // diff works off lock.rules (the installed set), not the seed profile --
    // mirrors statusReport's SSoT-lock model.
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(source, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution', 'ghost'] } }))

    const result = await diffReport(ctxWith(), { source, target })

    expect(result.ok).toBe(true)
    expect(result.diffs).toEqual([])
    expect(result.exitCode).toBe(0)
  })

  test('rules-only target (profile "-") diffs cleanly without consulting profiles.json', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-diff-tgt-'))
    const initResult = await runInit(ctxWith(), { source, rules: ['constitution'], profile: '-', target, force: false })
    if (!initResult.ok) throw new Error(`fixture init failed: ${initResult.message}`)

    const clean = await diffReport(ctxWith(), { source, target })
    expect(clean.ok).toBe(true)
    expect(clean.diffs).toEqual([])

    writeFileSync(join(source, 'rules', 'constitution.md'), '# Constitution\n\nline a\n')
    const result = await diffReport(ctxWith(), { source, target })
    expect(result.ok).toBe(true)
    expect(result.diffs).toEqual([{ rule: 'constitution', state: 'outdated', additions: 2, deletions: 0 }])
    expect(result.exitCode).toBe(1)
  })
})

describe('diffReport --rule (named mode)', () => {
  test('unknown name fails listing known rules; a name outside lock.rules/excluded fails the same way', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)

    const unknown = await diffReport(ctxWith(), { source, target, rule: 'ghost' })
    expect(unknown.ok).toBe(false)
    expect(unknown.message).toContain('ghost')
    expect(unknown.message).toContain('constitution')
    expect(unknown.diffs).toEqual([])
    expect(unknown.exitCode).toBe(1)

    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])
    const otherTarget = await initTarget(fixtureSource())
    const notInstalled = await diffReport(ctxWith(), { source, target: otherTarget, rule: 'extra' })
    expect(notInstalled.ok).toBe(false)
    expect(notInstalled.message).toContain('extra')
    expect(notInstalled.message).toContain('constitution')
    expect(notInstalled.diffs).toEqual([])
  })

  test('identical content yields a zero-count synced entry with a patch header present, exit 0', async () => {
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

  test('exact added/removed line counts and a well-formed unified patch, from a fixed two-text fixture', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    // local (baseline) content is '# Constitution\n' (one line).
    // source moves to a 3-line text: this replaces line 1 and adds 2 new lines.
    writeFileSync(join(source, 'rules', 'constitution.md'), 'line one\nline two\nline three\n')

    const result = await diffReport(ctxWith(), { source, target, rule: 'constitution' })

    expect(result.ok).toBe(true)
    const entry = result.diffs[0]
    if (entry === undefined) throw new Error('expected a diff entry')
    expect(entry.state).toBe('outdated')
    expect(entry.deletions).toBe(1)
    expect(entry.additions).toBe(3)
    expect(entry.patch).toContain('+line one')
    expect(entry.patch).toContain('-# Constitution')
    expect(entry.patch).toContain('constitution (local)')
    expect(entry.patch).toContain('constitution (source)')
    expect(result.exitCode).toBe(1)
  })

  test('local file missing diffs against empty string, reports state missing, all additions', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    rmSync(join(target, '.claude/rules/constitution.md'))

    const result = await diffReport(ctxWith(), { source, target, rule: 'constitution' })

    expect(result.ok).toBe(true)
    const entry = result.diffs[0]
    if (entry === undefined) throw new Error('expected a diff entry')
    expect(entry.state).toBe('missing')
    expect(entry.deletions).toBe(0)
    expect(entry.additions).toBe(1)
    expect(entry.patch).toContain('+# Constitution')
    expect(result.exitCode).toBe(1)
  })

  test('an excluded rule can be diffed directly even though the bare summary omits it', async () => {
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
})
