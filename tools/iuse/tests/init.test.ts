import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Catalog } from '../src/core/contract'
import { runInit } from '../src/core/init'
import type { IuseContext } from '../src/core/init'
import { loadDownstreamLock } from '../src/core/manifest'

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-init-src-'))
  mkdirSync(join(dir, 'rules'), { recursive: true })
  mkdirSync(join(dir, 'templates'), { recursive: true })
  writeFileSync(join(dir, 'rules', 'constitution.md'), '# Constitution\n')
  writeFileSync(join(dir, 'rules', 'markdown.md'), '# Markdown\n')
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution', 'markdown'] } }))
  writeFileSync(join(dir, 'templates', 'settings.json'), JSON.stringify({ model: 'sonnet' }))
  writeFileSync(join(dir, 'templates', 'architecture.md'), '# [PROJECT_NAME] - Architecture\n\nbody\n')
  writeFileSync(join(dir, 'templates', 'claude-md.md'), '# [PROJECT_NAME]\n\nbody\n')
  writeFileSync(join(dir, 'templates', 'template-instantiate.md'), '# contract\n')
  const catalog: Catalog = {
    generatedAt: '2026-07-19T00:00:00Z',
    tags: { concern: { exclusive: false, values: { core: 'x', docs: 'x' } } },
    rules: {
      constitution: { description: 'x', tags: ['core'], requires: [], scope: 'global', path: 'rules/constitution.md', profiles: ['demo'] },
      markdown: { description: 'x', tags: ['docs'], requires: [], scope: '**/*.md', path: 'rules/markdown.md', profiles: ['demo'] },
    },
  }
  writeFileSync(join(dir, 'catalog.json'), JSON.stringify(catalog, null, 2))
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

const demoInstantiate = (targetFile: string): string =>
  targetFile.endsWith('architecture.md') ? '# demo - Architecture\n\nbody\n' : '# demo\n\nbody\n'

describe('runInit happy path', () => {
  test('assembles rules, copies settings, instantiates templates, writes a lock with the right shape', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const ctx = ctxWith(fakeClaudeWriting(demoInstantiate))

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

  test('pre-existing .claude/settings.json is left untouched without --force, and the skip is surfaced in both the message and onProgress', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    mkdirSync(join(target, '.claude'), { recursive: true })
    const preExisting = JSON.stringify({ model: 'custom-preexisting' })
    writeFileSync(join(target, '.claude/settings.json'), preExisting)
    const ctx = ctxWith(fakeClaudeWriting(demoInstantiate))

    const collectedSteps: Array<{ op: string; target: string; note?: string }> = []
    const result = await runInit(ctx, { source, profile: 'demo', target, force: false, onProgress: (step) => collectedSteps.push(step) })

    expect(result.ok).toBe(true)
    expect(readFileSync(join(target, '.claude/settings.json'), 'utf8')).toBe(preExisting)
    expect(result.message).toContain('.claude/settings.json')
    expect(result.message).toContain('skipped')
    expect(collectedSteps.some((s) => s.op === 'copy-settings' && s.note === 'skipped: already present')).toBe(true)
  })

  test('real init returns ordered steps ending write-lock, notes skipped settings, and onProgress mirrors result.steps', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    mkdirSync(join(target, '.claude'), { recursive: true })
    writeFileSync(join(target, '.claude/settings.json'), JSON.stringify({ model: 'custom-preexisting' }))
    const ctx = ctxWith(fakeClaudeWriting(demoInstantiate))

    const seenOps: string[] = []
    const result = await runInit(ctx, { source, profile: 'demo', target, force: false, onProgress: (step) => seenOps.push(step.op) })

    expect(result.ok).toBe(true)
    const steps = result.steps ?? []
    const ops = steps.map((s) => s.op)
    expect(ops).toContain('copy-rule')
    expect(ops).toContain('copy-settings')
    expect(ops).toContain('instantiate')
    expect(ops[ops.length - 1]).toBe('write-lock')
    expect(steps.find((s) => s.op === 'write-lock')?.target).toBe('.claude/infra-ai.lock.json')
    expect(steps.find((s) => s.op === 'copy-settings')?.note).toContain('skipped')
    expect(seenOps).toEqual(ops)
  })
})

/**
 * A dev-repo checkout in the artifacts/ staging layout (Task 1): catalog.json
 * and rule/template artifacts staged under artifacts/, profiles.json at the
 * raw root (editing account). Exercises the source-root detection wired into
 * planInit/runInit's template-side reads (settings.json copy, the
 * template-instantiate.md contract, and TEMPLATE_SPECS' sourceRelPath) --
 * without it these would resolve against the wrong base and either
 * silently skip (settings.json, via readTextIfExists returning null) or
 * fail with a misleading "contract missing" message.
 */
function devSourceFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-init-dev-src-'))
  mkdirSync(join(dir, 'artifacts', 'rules'), { recursive: true })
  mkdirSync(join(dir, 'artifacts', 'templates'), { recursive: true })
  writeFileSync(join(dir, 'artifacts', 'rules', 'constitution.md'), '# Constitution\n')
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution'] } }))
  writeFileSync(join(dir, 'artifacts', 'templates', 'settings.json'), JSON.stringify({ model: 'sonnet' }))
  writeFileSync(join(dir, 'artifacts', 'templates', 'architecture.md'), '# [PROJECT_NAME] - Architecture\n\nbody\n')
  writeFileSync(join(dir, 'artifacts', 'templates', 'claude-md.md'), '# [PROJECT_NAME]\n\nbody\n')
  writeFileSync(join(dir, 'artifacts', 'templates', 'template-instantiate.md'), '# contract\n')
  const catalog: Catalog = {
    generatedAt: '2026-07-19T00:00:00Z',
    tags: {},
    rules: {
      constitution: { description: 'x', tags: ['core'], requires: [], scope: 'global', path: 'rules/constitution.md', profiles: ['demo'] },
    },
  }
  writeFileSync(join(dir, 'artifacts', 'catalog.json'), JSON.stringify(catalog, null, 2))
  return dir
}

describe('runInit against a dev-repo artifacts/ layout source', () => {
  test('resolves settings.json and the template-instantiate.md contract from artifacts/, not the raw root', async () => {
    const source = devSourceFixture()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-devtgt-'))
    const ctx = ctxWith(fakeClaudeWriting(demoInstantiate))

    const result = await runInit(ctx, { source, profile: 'demo', target, force: false })

    expect(result.ok).toBe(true)
    expect(readFileSync(join(target, '.claude/rules/constitution.md'), 'utf8')).toBe('# Constitution\n')
    expect(JSON.parse(readFileSync(join(target, '.claude/settings.json'), 'utf8'))).toEqual({ model: 'sonnet' })
    expect(readFileSync(join(target, '.claude/rules/architecture.md'), 'utf8')).toBe('# demo - Architecture\n\nbody\n')
    expect(readFileSync(join(target, 'CLAUDE.md'), 'utf8')).toBe('# demo\n\nbody\n')
  })
})

describe('runInit re-init guards', () => {
  test('existing lock without --force fails pointing at update, whether via a hand-written lock or a real prior init', async () => {
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
    const handWritten = await runInit(ctx, { source, profile: 'demo', target, force: false })
    expect(handWritten.ok).toBe(false)
    expect(handWritten.message).toContain('iuse update')
    expect(handWritten.message).toContain('--force')

    const realSource = fixtureSource()
    const realTarget = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const realCtx = ctxWith(fakeClaudeWriting(demoInstantiate))
    const first = await runInit(realCtx, { source: realSource, profile: 'demo', target: realTarget, force: false })
    expect(first.ok).toBe(true)
    const second = await runInit(realCtx, { source: realSource, profile: 'demo', target: realTarget, force: false })
    expect(second.ok).toBe(false)
    expect(second.message).toContain('iuse update')
    expect(second.message).toContain('--force')
  })

  test('force re-init refreshes lock, re-validates instantiation (claude invoked again), and skips unchanged rule writes', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const { claude, calls } = countingFakeClaudeWriting(demoInstantiate)

    const firstResult = await runInit(ctxWith(claude, () => '2026-07-17T00:00:00Z'), { source, profile: 'demo', target, force: false })
    expect(firstResult.ok).toBe(true)
    expect(calls()).toBe(2) // architecture + claude-md

    // rule content is byte-identical to the first run, so the force path's
    // `existsSync && same content` branch (init.ts:123) skips the rewrite --
    // observed indirectly via content staying correct with no write error.
    const collectedSteps: Array<{ op: string; target: string; note?: string }> = []
    const secondResult = await runInit(ctxWith(claude, () => '2026-08-01T00:00:00Z'), {
      source, profile: 'demo', target, force: true, onProgress: (step) => collectedSteps.push(step),
    })

    expect(secondResult.ok).toBe(true)
    // instantiation is a write-time gate, not a standing invariant: --force
    // re-validates, so the fake claude is invoked again for both templates
    expect(calls()).toBe(4)
    const skipSteps = collectedSteps.filter((s) => s.note?.startsWith('skipped:'))
    expect(skipSteps.some((s) => s.op === 'copy-rule' && s.note === 'skipped: unchanged')).toBe(true)

    expect(readFileSync(join(target, '.claude/rules/constitution.md'), 'utf8')).toBe('# Constitution\n')
    expect(readFileSync(join(target, '.claude/rules/architecture.md'), 'utf8')).toBe('# demo - Architecture\n\nbody\n')
    const lock = loadDownstreamLock(target)
    expect(lock?.appliedAt).toBe('2026-08-01T00:00:00Z')
  })
})

describe('runInit failure paths return ok:false instead of throwing', () => {
  test('composition violations, unknown profile, source resolution failure, and gh: download rejection all fail cleanly without a lock', async () => {
    const source = fixtureSource()
    writeFileSync(join(source, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution', 'markdown', 'ghost'] } }))
    const compositionTarget = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const composition = await runInit(ctxWith(fakeClaudeWriting(() => '# demo\n')), { source, profile: 'demo', target: compositionTarget, force: false })
    expect(composition.ok).toBe(false)
    expect(composition.message).toContain('ghost')
    expect(existsSync(join(compositionTarget, '.claude/rules/constitution.md'))).toBe(false)
    expect(loadDownstreamLock(compositionTarget)).toBeNull()

    const cleanSource = fixtureSource()
    const unknownTarget = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const unknown = await runInit(ctxWith(fakeClaudeWriting(() => '# demo\n')), { source: cleanSource, profile: 'nope', target: unknownTarget, force: false })
    expect(unknown.ok).toBe(false)
    expect(unknown.message).toContain("unknown profile 'nope'")

    const badSource = mkdtempSync(join(tmpdir(), 'iuse-init-badsrc-'))
    const badSourceTarget = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const badSourceResult = await runInit(ctxWith(fakeClaudeWriting(() => '# demo\n')), { source: badSource, profile: 'demo', target: badSourceTarget, force: false })
    expect(badSourceResult.ok).toBe(false)
    expect(badSourceResult.message).toContain('profiles.json not found')

    const ghTarget = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const ghCtx: IuseContext = { ...ctxWith(fakeClaudeWriting(() => '# demo\n')), download: async () => { throw new Error('network unreachable') } }
    const ghResult = await runInit(ghCtx, { source: 'gh:someorg/somerepo', profile: 'demo', target: ghTarget, force: false })
    expect(ghResult.ok).toBe(false)
    expect(ghResult.message).toContain('network unreachable')
  })

  test('leftover [ALL_CAPS] placeholder after instantiation fails, but rules copied before instantiation stay on disk', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const ctx = ctxWith(fakeClaudeWriting(() => '# [PROJECT_NAME] - Architecture\n\nbody\n'))

    const result = await runInit(ctx, { source, profile: 'demo', target, force: false })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('placeholder')
    expect(result.message).toContain('--force')
    expect(existsSync(join(target, '.claude/rules/constitution.md'))).toBe(true)
    expect(loadDownstreamLock(target)).toBeNull()
  })

  test('source missing the relocated template contract fails without invoking claude at all', async () => {
    const source = fixtureSource()
    unlinkSync(join(source, 'templates', 'template-instantiate.md'))
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const { claude, calls } = countingFakeClaudeWriting(demoInstantiate)

    const result = await runInit(ctxWith(claude), { source, profile: 'demo', target, force: false })

    expect(result.ok).toBe(false)
    expect(result.message).toContain(join(source, 'templates/template-instantiate.md'))
    expect(result.message).toContain('imeta publish')
    expect(calls()).toBe(0)
    expect(loadDownstreamLock(target)).toBeNull()
  })
})

describe('runInit --dry-run', () => {
  test('writes nothing, never invokes claude, and lists the full plan (copy-rule, copy-settings, instantiate, write-lock last)', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const { claude, calls } = countingFakeClaudeWriting(demoInstantiate)

    const result = await runInit(ctxWith(claude), { source, profile: 'demo', target, force: false, dryRun: true })

    expect(result.ok).toBe(true)
    expect(existsSync(join(target, '.claude'))).toBe(false)
    expect(existsSync(join(target, 'CLAUDE.md'))).toBe(false)
    expect(loadDownstreamLock(target)).toBeNull()
    expect(calls()).toBe(0)

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

    const lines = result.message.split('\n')
    expect(lines).toContain('write-lock .claude/infra-ai.lock.json')
    expect(lines.some((l) => l.startsWith('copy-rule .claude/rules/constitution.md'))).toBe(true)
  })

  test('still fails on composition violations and on an existing lock without --force, without writing anything', async () => {
    const source = fixtureSource()
    writeFileSync(join(source, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution', 'markdown', 'ghost'] } }))
    const compositionTarget = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const composition = await runInit(ctxWith(fakeClaudeWriting(() => '# demo\n')), { source, profile: 'demo', target: compositionTarget, force: false, dryRun: true })
    expect(composition.ok).toBe(false)
    expect(composition.message).toContain('ghost')
    expect(existsSync(join(compositionTarget, '.claude'))).toBe(false)
    expect(loadDownstreamLock(compositionTarget)).toBeNull()

    const cleanSource = fixtureSource()
    const lockedTarget = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    mkdirSync(join(lockedTarget, '.claude'), { recursive: true })
    writeFileSync(
      join(lockedTarget, '.claude/infra-ai.lock.json'),
      JSON.stringify({
        source: { type: 'local', id: 'x', locator: cleanSource },
        profile: 'demo',
        appliedAt: '2026-01-01T00:00:00Z',
        rules: {},
        templates: [],
      }),
    )
    const locked = await runInit(ctxWith(fakeClaudeWriting(() => '# demo\n')), { source: cleanSource, profile: 'demo', target: lockedTarget, force: false, dryRun: true })
    expect(locked.ok).toBe(false)
    expect(locked.message).toContain('iuse update')
  })
})

describe('runInit --exclude', () => {
  test('keeps the excluded rule uncopied, out of lock.rules, recorded sorted+deduped in lock.excluded, and fires onProgress exclude-rule', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const ctx = ctxWith(fakeClaudeWriting(demoInstantiate))

    const seenOps: string[] = []
    const result = await runInit(ctx, {
      source, profile: 'demo', target, force: false, exclude: ['markdown', 'markdown'], onProgress: (step) => seenOps.push(step.op),
    })

    expect(result.ok).toBe(true)
    expect(existsSync(join(target, '.claude/rules/markdown.md'))).toBe(false)
    expect(readFileSync(join(target, '.claude/rules/constitution.md'), 'utf8')).toBe('# Constitution\n')
    const lock = loadDownstreamLock(target)
    expect(Object.keys(lock?.rules ?? {})).toEqual(['constitution'])
    expect(lock?.excluded).toEqual(['markdown'])
    expect(seenOps).toContain('exclude-rule')
  })

  test('a rule not in the profile fails listing the profile rules', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const ctx = ctxWith(fakeClaudeWriting(() => '# demo\n'))

    const result = await runInit(ctx, { source, profile: 'demo', target, force: false, exclude: ['ghost'] })

    expect(result.ok).toBe(false)
    expect(result.message).toBe("unknown rules in --exclude: ghost (profile rules: constitution, markdown)")
    expect(loadDownstreamLock(target)).toBeNull()
  })

  test('dry-run surfaces an exclude-rule step instead of copy-rule, and writes nothing', async () => {
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
})

describe('runInit with explicit --rules (profile "-")', () => {
  test('writes lock.profile "-" with only the named rules', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const ctx = ctxWith(fakeClaudeWriting(demoInstantiate))

    const result = await runInit(ctx, { source, profile: '-', rules: ['constitution'], target, force: false })

    expect(result.ok).toBe(true)
    const lock = loadDownstreamLock(target)
    expect(lock?.profile).toBe('-')
    expect(Object.keys(lock?.rules ?? {})).toEqual(['constitution'])
    expect(existsSync(join(target, '.claude/rules/markdown.md'))).toBe(false)
  })

  test('an unknown name fails listing unknown rules; --exclude is rejected as a profile-only option; missing artifact fails with imeta build hint', async () => {
    const source = fixtureSource()
    const ctx = ctxWith(fakeClaudeWriting(() => '# demo\n'))

    const unknownTarget = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const unknown = await runInit(ctx, { source, profile: '-', rules: ['constitution', 'ghost'], target: unknownTarget, force: false })
    expect(unknown.ok).toBe(false)
    expect(unknown.message).toContain('unknown rules: ghost')
    expect(loadDownstreamLock(unknownTarget)).toBeNull()

    const excludeTarget = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const excludeRejected = await runInit(ctx, { source, profile: '-', rules: ['constitution'], target: excludeTarget, force: false, exclude: ['constitution'] })
    expect(excludeRejected.ok).toBe(false)
    expect(loadDownstreamLock(excludeTarget)).toBeNull()

    const brokenSource = fixtureSource()
    const catalog = JSON.parse(readFileSync(join(brokenSource, 'catalog.json'), 'utf8')) as Catalog
    catalog.rules.broken = { description: 'x', tags: ['core'], requires: [], scope: 'global', path: 'rules/broken.md', profiles: [] }
    writeFileSync(join(brokenSource, 'catalog.json'), JSON.stringify(catalog, null, 2))
    const brokenTarget = mkdtempSync(join(tmpdir(), 'iuse-init-tgt-'))
    const broken = await runInit(ctx, { source: brokenSource, profile: '-', rules: ['constitution', 'broken'], target: brokenTarget, force: false })
    expect(broken.ok).toBe(false)
    expect(broken.message).toContain('imeta build')
    expect(loadDownstreamLock(brokenTarget)).toBeNull()
  })
})
