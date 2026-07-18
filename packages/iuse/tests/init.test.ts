import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInit } from '../src/core/init'
import type { IuseContext } from '../src/core/init'
import { loadDownstreamLock } from '../src/core/manifest'

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-init-src-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  mkdirSync(join(dir, 'rules', 'global'), { recursive: true })
  mkdirSync(join(dir, 'rules', 'scoped'), { recursive: true })
  mkdirSync(join(dir, 'templates'), { recursive: true })
  writeFileSync(
    join(dir, 'meta', 'tags.json'),
    JSON.stringify({ concern: { exclusive: false, values: { core: 'x', docs: 'x' } } }),
  )
  writeFileSync(
    join(dir, 'meta', 'rules', 'constitution.md'),
    '---\nname: constitution\nstatus: ready\nscope: global\ntags: [core]\n---\nbody',
  )
  writeFileSync(
    join(dir, 'meta', 'rules', 'markdown.md'),
    '---\nname: markdown\nstatus: ready\nscope: "**/*.md"\ntags: [docs]\n---\nbody',
  )
  writeFileSync(join(dir, 'rules', 'global', 'constitution.md'), '# Constitution\n')
  writeFileSync(join(dir, 'rules', 'scoped', 'markdown.md'), '---\npaths:\n  - "**/*.md"\n---\n# Markdown\n')
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution', 'markdown'] } }))
  writeFileSync(join(dir, 'templates', 'settings.json'), JSON.stringify({ model: 'sonnet' }))
  writeFileSync(join(dir, 'templates', 'architecture.md'), '# [PROJECT_NAME] - Architecture\n\nbody\n')
  writeFileSync(join(dir, 'templates', 'claude-md.md'), '# [PROJECT_NAME]\n\nbody\n')
  mkdirSync(join(dir, 'meta', 'prompts'), { recursive: true })
  writeFileSync(join(dir, 'meta', 'prompts', 'template-instantiate.md'), '# contract\n')
  return dir
}

function fakeClaudeWriting(fileContent: (targetFile: string) => string): IuseContext['claude'] {
  return async (opts) => {
    const match = /(?:Write|Edit)\((.+)\)/u.exec(opts.allowedTools)
    const rel = match?.[1]
    if (rel === undefined) throw new Error('no target file in allowedTools')
    // 权限模式是相对项目根的路径，真实 claude 也以 repoRoot 为 cwd 解析
    const targetFile = join(opts.repoRoot, rel)
    writeFileSync(targetFile, fileContent(targetFile))
    return { code: 0, timedOut: false, stderr: '' }
  }
}

function countingFakeClaudeWriting(fileContent: (targetFile: string) => string): {
  claude: IuseContext['claude']
  calls: () => number
} {
  let calls = 0
  const claude: IuseContext['claude'] = async (opts) => {
    calls += 1
    const match = /(?:Write|Edit)\((.+)\)/u.exec(opts.allowedTools)
    const rel = match?.[1]
    if (rel === undefined) throw new Error('no target file in allowedTools')
    const targetFile = join(opts.repoRoot, rel)
    writeFileSync(targetFile, fileContent(targetFile))
    return { code: 0, timedOut: false, stderr: '' }
  }
  return { claude, calls: () => calls }
}

function ctxWith(claude: IuseContext['claude'], now: () => string = () => '2026-07-17T00:00:00Z'): IuseContext {
  return {
    download: async () => ({}),
    run: async () => ({ code: 0, stdout: 'head1\n', stderr: '' }),
    claude,
    now,
    env: {},
    home: '/nope',
    cacheDir: '/tmp/iuse-cache',
  }
}

describe('runInit', () => {
  test('assembles rules, copies settings, instantiates templates, writes lock', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const claude = fakeClaudeWriting((targetFile) =>
      targetFile.endsWith('architecture.md') ? '# demo - Architecture\n\nbody\n' : '# demo\n\nbody\n',
    )
    const ctx = ctxWith(claude)

    const result = await runInit(ctx, { source, profile: 'demo', target, force: false })

    expect(result.ok).toBe(true)
    expect(readFileSync(join(target, '.claude/rules/constitution.md'), 'utf8')).toBe('# Constitution\n')
    expect(readFileSync(join(target, '.claude/rules/markdown.md'), 'utf8')).toContain('# Markdown')
    expect(JSON.parse(readFileSync(join(target, '.claude/settings.json'), 'utf8'))).toEqual({ model: 'sonnet' })
    expect(readFileSync(join(target, '.claude/rules/architecture.md'), 'utf8')).toBe('# demo - Architecture\n\nbody\n')
    expect(readFileSync(join(target, 'CLAUDE.md'), 'utf8')).toBe('# demo\n\nbody\n')

    const lock = loadDownstreamLock(target)
    expect(lock).not.toBeNull()
    expect(lock?.profile).toBe('demo')
    expect(lock?.appliedAt).toBe('2026-07-17T00:00:00Z')
    expect(lock?.templates).toEqual(['architecture', 'claude-md'])
    expect(Object.keys(lock?.rules ?? {}).toSorted()).toEqual(['constitution', 'markdown'])
    expect(lock?.source.type).toBe('local')
    expect(lock?.source.locator).toBe(source)
  })

  test('existing lock without --force fails pointing at update', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    mkdirSync(join(target, '.claude'), { recursive: true })
    writeFileSync(
      join(target, '.claude/infra-ai.lock.json'),
      JSON.stringify({
        source: { type: 'local', id: 'x', locator: source },
        profile: 'demo',
        appliedAt: '2026-01-01T00:00:00Z',
        rules: {},
        templates: [],
      }),
    )

    const ctx = ctxWith(fakeClaudeWriting(() => '# demo\n'))
    const result = await runInit(ctx, { source, profile: 'demo', target, force: false })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('iuse update')
    expect(result.message).toContain('--force')
  })

  test('composition violations refuse init', async () => {
    const source = fixtureSource()
    writeFileSync(
      join(source, 'profiles.json'),
      JSON.stringify({ demo: { rules: ['constitution', 'markdown', 'ghost'] } }),
    )
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const ctx = ctxWith(fakeClaudeWriting(() => '# demo\n'))

    const result = await runInit(ctx, { source, profile: 'demo', target, force: false })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('ghost')
    expect(existsSync(join(target, '.claude/rules/constitution.md'))).toBe(false)
    expect(loadDownstreamLock(target)).toBeNull()
  })

  test('leftover [ALL_CAPS] after instantiation fails', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const claude = fakeClaudeWriting(() => '# [PROJECT_NAME] - Architecture\n\nbody\n')
    const ctx = ctxWith(claude)

    const result = await runInit(ctx, { source, profile: 'demo', target, force: false })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('placeholder')
    expect(result.message).toContain('--force')
    // rules copied before instantiation stay even though init failed
    expect(existsSync(join(target, '.claude/rules/constitution.md'))).toBe(true)
    expect(loadDownstreamLock(target)).toBeNull()
  })

  test('force re-init refreshes lock, re-validates instantiation, and skips unchanged rule writes', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const { claude, calls } = countingFakeClaudeWriting((targetFile) =>
      targetFile.endsWith('architecture.md') ? '# demo - Architecture\n\nbody\n' : '# demo\n\nbody\n',
    )

    const firstCtx = ctxWith(claude, () => '2026-07-17T00:00:00Z')
    const firstResult = await runInit(firstCtx, { source, profile: 'demo', target, force: false })
    expect(firstResult.ok).toBe(true)
    expect(calls()).toBe(2) // architecture + claude-md

    // rule content is byte-identical to the first run, so the force path's
    // `existsSync && same content` branch (init.ts:123) skips the rewrite —
    // observed indirectly via content staying correct with no write error.
    const collectedSteps: Array<{ op: string; target: string; note?: string }> = []
    const secondCtx = ctxWith(claude, () => '2026-08-01T00:00:00Z')
    const secondResult = await runInit(secondCtx, { source, profile: 'demo', target, force: true, onProgress: (step) => collectedSteps.push(step) })

    expect(secondResult.ok).toBe(true)
    // instantiation is a write-time gate, not a standing invariant: --force
    // re-validates, so the fake claude is invoked again for both templates
    expect(calls()).toBe(4)

    // onProgress fires for all steps including skips: copy-rule with note 'skipped: unchanged'
    const skipSteps = collectedSteps.filter((s) => s.note?.startsWith('skipped:'))
    expect(skipSteps.length).toBeGreaterThan(0)
    expect(skipSteps.some((s) => s.op === 'copy-rule' && s.note === 'skipped: unchanged')).toBe(true)

    expect(readFileSync(join(target, '.claude/rules/constitution.md'), 'utf8')).toBe('# Constitution\n')
    expect(readFileSync(join(target, '.claude/rules/markdown.md'), 'utf8')).toContain('# Markdown')
    expect(readFileSync(join(target, '.claude/rules/architecture.md'), 'utf8')).toBe('# demo - Architecture\n\nbody\n')
    expect(readFileSync(join(target, 'CLAUDE.md'), 'utf8')).toBe('# demo\n\nbody\n')

    const lock = loadDownstreamLock(target)
    expect(lock).not.toBeNull()
    expect(lock?.appliedAt).toBe('2026-08-01T00:00:00Z')
  })

  test('re-init without --force after a successful init fails pointing at update', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const claude = fakeClaudeWriting((targetFile) =>
      targetFile.endsWith('architecture.md') ? '# demo - Architecture\n\nbody\n' : '# demo\n\nbody\n',
    )
    const ctx = ctxWith(claude)

    const firstResult = await runInit(ctx, { source, profile: 'demo', target, force: false })
    expect(firstResult.ok).toBe(true)

    const secondResult = await runInit(ctx, { source, profile: 'demo', target, force: false })

    expect(secondResult.ok).toBe(false)
    expect(secondResult.message).toContain('iuse update')
    expect(secondResult.message).toContain('--force')
  })

  test('pre-existing .claude/settings.json is left untouched without --force', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    mkdirSync(join(target, '.claude'), { recursive: true })
    const preExisting = JSON.stringify({ model: 'custom-preexisting' })
    writeFileSync(join(target, '.claude/settings.json'), preExisting)

    const claude = fakeClaudeWriting((targetFile) =>
      targetFile.endsWith('architecture.md') ? '# demo - Architecture\n\nbody\n' : '# demo\n\nbody\n',
    )
    const ctx = ctxWith(claude)

    const collectedSteps: Array<{ op: string; target: string; note?: string }> = []
    // fresh target: no lock yet, so init proceeds even with force: false
    const result = await runInit(ctx, { source, profile: 'demo', target, force: false, onProgress: (step) => collectedSteps.push(step) })

    expect(result.ok).toBe(true)
    expect(readFileSync(join(target, '.claude/settings.json'), 'utf8')).toBe(preExisting)
    expect(result.message).toContain('.claude/settings.json')
    expect(result.message).toContain('skipped')

    // onProgress fires for skip-flavored copy-settings step
    expect(collectedSteps.some((s) => s.op === 'copy-settings' && s.note === 'skipped: already present')).toBe(true)
  })

  test('unknown profile returns a clean ok:false instead of throwing', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const ctx = ctxWith(fakeClaudeWriting(() => '# demo\n'))

    const result = await runInit(ctx, { source, profile: 'nope', target, force: false })

    expect(result.ok).toBe(false)
    expect(result.message).toContain("unknown profile 'nope'")
  })

  test('source resolution failure returns a clean ok:false instead of throwing', async () => {
    const badSource = mkdtempSync(join(tmpdir(), 'iuse-init-badsrc-'))
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const ctx = ctxWith(fakeClaudeWriting(() => '# demo\n'))

    const result = await runInit(ctx, { source: badSource, profile: 'demo', target, force: false })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('profiles.json not found')
  })

  test('rejecting download for a gh: source returns a clean ok:false instead of throwing', async () => {
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const ctx: IuseContext = {
      ...ctxWith(fakeClaudeWriting(() => '# demo\n')),
      download: async () => {
        throw new Error('network unreachable')
      },
    }

    const result = await runInit(ctx, { source: 'gh:someorg/somerepo', profile: 'demo', target, force: false })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('network unreachable')
  })

  test('init --dry-run writes nothing and lists the full plan', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const { claude, calls } = countingFakeClaudeWriting((targetFile) =>
      targetFile.endsWith('architecture.md') ? '# demo - Architecture\n\nbody\n' : '# demo\n\nbody\n',
    )
    const ctx = ctxWith(claude)

    const result = await runInit(ctx, { source, profile: 'demo', target, force: false, dryRun: true })

    expect(result.ok).toBe(true)
    expect(existsSync(join(target, '.claude'))).toBe(false)
    expect(existsSync(join(target, 'CLAUDE.md'))).toBe(false)
    expect(loadDownstreamLock(target)).toBeNull()
    expect(calls()).toBe(0) // instantiate steps are listed, never pre-run

    const steps = result.steps ?? []
    const ops = steps.map((s) => s.op)
    expect(ops).toContain('copy-rule')
    expect(ops).toContain('copy-settings')
    expect(ops).toContain('instantiate')
    expect(ops[ops.length - 1]).toBe('write-lock')

    const ruleTargets = steps.filter((s) => s.op === 'copy-rule').map((s) => s.target)
    expect(ruleTargets.toSorted()).toEqual(['.claude/rules/constitution.md', '.claude/rules/markdown.md'])

    const instantiateTargets = steps.filter((s) => s.op === 'instantiate').map((s) => s.target)
    expect(instantiateTargets.toSorted()).toEqual(['.claude/rules/architecture.md', 'CLAUDE.md'])

    // message is a plain <op> <target> (+ note) listing, matching the planned steps
    const lines = result.message.split('\n')
    expect(lines).toContain('write-lock .claude/infra-ai.lock.json')
    expect(lines.some((l) => l.startsWith('copy-rule .claude/rules/constitution.md'))).toBe(true)
  })

  test('init --dry-run still fails on composition violations', async () => {
    const source = fixtureSource()
    writeFileSync(
      join(source, 'profiles.json'),
      JSON.stringify({ demo: { rules: ['constitution', 'markdown', 'ghost'] } }),
    )
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const ctx = ctxWith(fakeClaudeWriting(() => '# demo\n'))

    const result = await runInit(ctx, { source, profile: 'demo', target, force: false, dryRun: true })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('ghost')
    expect(existsSync(join(target, '.claude'))).toBe(false)
    expect(loadDownstreamLock(target)).toBeNull()
  })

  test('init --dry-run still fails when already initialized without --force', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    mkdirSync(join(target, '.claude'), { recursive: true })
    writeFileSync(
      join(target, '.claude/infra-ai.lock.json'),
      JSON.stringify({
        source: { type: 'local', id: 'x', locator: source },
        profile: 'demo',
        appliedAt: '2026-01-01T00:00:00Z',
        rules: {},
        templates: [],
      }),
    )

    const ctx = ctxWith(fakeClaudeWriting(() => '# demo\n'))
    const result = await runInit(ctx, { source, profile: 'demo', target, force: false, dryRun: true })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('iuse update')
  })

  test('real init still returns steps describing what happened', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const claude = fakeClaudeWriting((targetFile) =>
      targetFile.endsWith('architecture.md') ? '# demo - Architecture\n\nbody\n' : '# demo\n\nbody\n',
    )
    const ctx = ctxWith(claude)

    const result = await runInit(ctx, { source, profile: 'demo', target, force: false })

    expect(result.ok).toBe(true)
    const steps = result.steps ?? []
    const ops = steps.map((s) => s.op)
    expect(ops).toContain('copy-rule')
    expect(ops).toContain('copy-settings')
    expect(ops).toContain('instantiate')
    expect(ops[ops.length - 1]).toBe('write-lock')
    expect(steps.find((s) => s.op === 'write-lock')?.target).toBe('.claude/infra-ai.lock.json')
  })

  test('real init steps note skipped settings when pre-existing without --force', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    mkdirSync(join(target, '.claude'), { recursive: true })
    writeFileSync(join(target, '.claude/settings.json'), JSON.stringify({ model: 'custom-preexisting' }))

    const claude = fakeClaudeWriting((targetFile) =>
      targetFile.endsWith('architecture.md') ? '# demo - Architecture\n\nbody\n' : '# demo\n\nbody\n',
    )
    const ctx = ctxWith(claude)

    const result = await runInit(ctx, { source, profile: 'demo', target, force: false })

    expect(result.ok).toBe(true)
    const settingsStep = (result.steps ?? []).find((s) => s.op === 'copy-settings')
    expect(settingsStep?.note).toContain('skipped')
  })

  test('--exclude keeps excluded rule uncopied, out of lock.rules, and recorded sorted+deduped in lock.excluded', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const claude = fakeClaudeWriting((targetFile) =>
      targetFile.endsWith('architecture.md') ? '# demo - Architecture\n\nbody\n' : '# demo\n\nbody\n',
    )
    const ctx = ctxWith(claude)

    const result = await runInit(ctx, {
      source,
      profile: 'demo',
      target,
      force: false,
      exclude: ['markdown', 'markdown'],
    })

    expect(result.ok).toBe(true)
    expect(existsSync(join(target, '.claude/rules/markdown.md'))).toBe(false)
    expect(readFileSync(join(target, '.claude/rules/constitution.md'), 'utf8')).toBe('# Constitution\n')

    const lock = loadDownstreamLock(target)
    expect(Object.keys(lock?.rules ?? {})).toEqual(['constitution'])
    expect(lock?.excluded).toEqual(['markdown'])
  })

  test('--exclude with a rule not in the profile fails listing the profile rules', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const ctx = ctxWith(fakeClaudeWriting(() => '# demo\n'))

    const result = await runInit(ctx, { source, profile: 'demo', target, force: false, exclude: ['ghost'] })

    expect(result.ok).toBe(false)
    expect(result.message).toBe("unknown rules in --exclude: ghost (profile rules: constitution, markdown)")
    expect(loadDownstreamLock(target)).toBeNull()
  })

  test('--exclude dry-run surfaces an exclude-rule step instead of copy-rule, and writes nothing', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const ctx = ctxWith(fakeClaudeWriting(() => '# demo\n'))

    const result = await runInit(ctx, { source, profile: 'demo', target, force: false, dryRun: true, exclude: ['markdown'] })

    expect(result.ok).toBe(true)
    const steps = result.steps ?? []
    expect(steps).toContainEqual({ op: 'exclude-rule', target: 'markdown', note: 'excluded' })
    expect(steps.some((s) => s.op === 'copy-rule' && s.target === '.claude/rules/markdown.md')).toBe(false)
    expect(existsSync(join(target, '.claude'))).toBe(false)
  })

  test('onProgress fires per executed step in order, not in dry-run', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const claude = fakeClaudeWriting((targetFile) =>
      targetFile.endsWith('architecture.md') ? '# demo - Architecture\n\nbody\n' : '# demo\n\nbody\n',
    )
    const ctx = ctxWith(claude)

    const seenOps: string[] = []
    const onProgress = (step: { op: string; target: string }) => seenOps.push(step.op)

    const result = await runInit(ctx, { source, profile: 'demo', target, force: false, onProgress })

    expect(result.ok).toBe(true)
    const resultOps = (result.steps ?? []).map((s) => s.op)
    expect(seenOps).toEqual(resultOps)

    // dry-run with onProgress should not fire the callback
    const target2 = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const seenOpsDry: string[] = []
    const onProgressDry = (step: { op: string; target: string }) => seenOpsDry.push(step.op)

    const resultDry = await runInit(ctx, { source, profile: 'demo', target: target2, force: false, dryRun: true, onProgress: onProgressDry })

    expect(resultDry.ok).toBe(true)
    expect(seenOpsDry.length).toBe(0)
  })
})
