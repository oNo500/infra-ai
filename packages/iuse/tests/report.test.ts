import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInit } from '../src/core/init'
import type { IuseContext } from '../src/core/init'
import { loadDownstreamLock, saveDownstreamLock } from '../src/core/manifest'
import { statusReport } from '../src/core/report'

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-report-src-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  mkdirSync(join(dir, 'rules', 'global'), { recursive: true })
  mkdirSync(join(dir, 'templates'), { recursive: true })
  writeFileSync(join(dir, 'meta', 'tags.json'), JSON.stringify({ concern: { exclusive: false, values: { core: 'x' } } }))
  writeFileSync(
    join(dir, 'meta', 'rules', 'constitution.md'),
    '---\nname: constitution\nstatus: ready\ndescription: x\nscope: global\ntags: [core]\n---\nbody',
  )
  writeFileSync(join(dir, 'rules', 'global', 'constitution.md'), '# Constitution\n')
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution'] } }))
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
  writeFileSync(join(source, 'rules', 'global', `${name}.md`), ruleBody)
}

function setProfileRules(source: string, rules: string[]): void {
  writeFileSync(join(source, 'profiles.json'), JSON.stringify({ demo: { rules } }))
}

function fakeClaudeWriting(): IuseContext['claude'] {
  return async (opts) => {
    const match = /(?:Write|Edit)\((.+)\)/u.exec(opts.allowedTools)
    const rel = match?.[1]
    if (rel === undefined) throw new Error('no target file in allowedTools')
    // 权限模式是相对项目根的路径，解析基准是 repoRoot（即目标项目）
    const targetFile = join(opts.repoRoot, rel)
    writeFileSync(targetFile, targetFile.endsWith('architecture.md') ? '# demo - Architecture\n\nbody\n' : '# demo\n\nbody\n')
    return { code: 0, timedOut: false, stderr: '' }
  }
}

function ctxWith(now: () => string = () => '2026-07-17T00:00:00Z', overrides: Partial<IuseContext> = {}): IuseContext {
  return {
    download: async () => ({}),
    run: async () => ({ code: 0, stdout: 'head1\n', stderr: '' }),
    claude: fakeClaudeWriting(),
    now,
    env: {},
    home: '/nope',
    cacheDir: '/tmp/iuse-cache',
    ...overrides,
  }
}

async function initTarget(source: string): Promise<string> {
  const target = mkdtempSync(join(tmpdir(), 'iuse-report-tgt-'))
  const result = await runInit(ctxWith(), { source, profile: 'demo', target, force: false })
  if (!result.ok) throw new Error(`fixture init failed: ${result.message}`)
  return target
}

describe('statusReport', () => {
  test('no lock at target fails pointing at init', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-report-tgt-'))

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('iuse init')
    expect(result.rows).toEqual([])
    expect(result.exitCode).toBe(1)
  })

  test('source resolution failure returns ok:false with the error message instead of throwing', async () => {
    const badSource = mkdtempSync(join(tmpdir(), 'iuse-report-badsrc-'))
    const target = await initTarget(fixtureSource())

    const result = await statusReport(ctxWith(), { source: badSource, target })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('profiles.json not found')
    expect(result.rows).toEqual([])
    expect(result.exitCode).toBe(1)
  })

  test('rejecting download for a gh: source returns ok:false with the rejection message', async () => {
    const target = await initTarget(fixtureSource())
    const ctx: IuseContext = {
      ...ctxWith(),
      download: async () => {
        throw new Error('network unreachable')
      },
    }

    const result = await statusReport(ctx, { source: 'gh:someorg/somerepo', target })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('network unreachable')
    expect(result.rows).toEqual([])
    expect(result.exitCode).toBe(1)
  })

  test('freshly initialized target is fully synced, exit 0', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.ok).toBe(true)
    expect(result.rows).toEqual([{ rule: 'constitution', state: 'synced' }])
    expect(result.exitCode).toBe(0)
  })

  test('locally edited rule reports modified', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(target, '.claude/rules/constitution.md'), '# Constitution\n\nlocally edited\n')

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.rows).toEqual([{ rule: 'constitution', state: 'modified' }])
    expect(result.exitCode).toBe(1)
  })

  test('source moved on, local untouched -> outdated', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(source, 'rules', 'global', 'constitution.md'), '# Constitution\n\nv2\n')

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.rows).toEqual([{ rule: 'constitution', state: 'outdated' }])
    expect(result.exitCode).toBe(1)
  })

  test('local copy deleted -> missing', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    rmSync(join(target, '.claude/rules/constitution.md'))

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.rows).toEqual([{ rule: 'constitution', state: 'missing' }])
    expect(result.exitCode).toBe(1)
  })

  test('profile-new rule reports available, not outdated, and does not affect exit code', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.ok).toBe(true)
    const extra = result.rows.find((r) => r.rule === 'extra')
    expect(extra?.state).toBe('available')
    expect(result.rows).toEqual([
      { rule: 'constitution', state: 'synced' },
      { rule: 'extra', state: 'available' },
    ])
    // 其余行全 synced 时 available 不把退出码顶成 1
    expect(result.exitCode).toBe(0)
  })

  test('rules-only target (profile "-") reports locked rules without consulting profiles', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-report-tgt-'))
    const initResult = await runInit(ctxWith(), { source, rules: ['constitution'], profile: '-', target, force: false })
    if (!initResult.ok) throw new Error(`fixture init failed: ${initResult.message}`)
    // profile 未消费种子——即便源端 profile 之后新增了 rule，也不出现 available 段
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.ok).toBe(true)
    expect(result.rows).toEqual([{ rule: 'constitution', state: 'synced' }])
    expect(result.exitCode).toBe(0)
  })

  test('rule still in lock.rules after being dropped from the source profile keeps reporting its normal drift state', async () => {
    const source = fixtureSource()
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])
    const target = await initTarget(source)

    setProfileRules(source, ['constitution'])

    const result = await statusReport(ctxWith(), { source, target })

    // lock.rules 是 SSoT：'extra' 的底层资产仍在源端存在（只是不在 profile 里了），
    // assembleRules 按名找回它，继续走正常 drift 判定——不再有 profile 一说。
    expect(result.rows).toEqual([
      { rule: 'constitution', state: 'synced' },
      { rule: 'extra', state: 'synced' },
    ])
    expect(result.exitCode).toBe(0)
  })

  test('excluded rule reports state excluded, merged sorted with the rest, and never flips exitCode', async () => {
    const source = fixtureSource()
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])
    const target = await initTarget(source)
    const lock = loadDownstreamLock(target)
    if (lock === null) throw new Error('fixture lock missing')
    const { extra: _extra, ...restRules } = lock.rules
    saveDownstreamLock(target, { ...lock, rules: restRules, excluded: ['extra'] })

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.ok).toBe(true)
    expect(result.rows).toEqual([
      { rule: 'constitution', state: 'synced' },
      { rule: 'extra', state: 'excluded' },
    ])
    expect(result.exitCode).toBe(0)
  })

  test('source profile gains a rule that is neither in lock.rules nor excluded -> reports available', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])
    const lock = loadDownstreamLock(target)
    if (lock === null) throw new Error('fixture lock missing')
    saveDownstreamLock(target, { ...lock, excluded: ['unrelated-excluded-name'] })

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.rows).toEqual([
      { rule: 'constitution', state: 'synced' },
      { rule: 'extra', state: 'available' },
      { rule: 'unrelated-excluded-name', state: 'excluded' },
    ])
    expect(result.exitCode).toBe(0) // 'extra' available does not drive exit 1
  })

  test('all synced plus an excluded rule -> exitCode stays 0', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    const lock = loadDownstreamLock(target)
    if (lock === null) throw new Error('fixture lock missing')
    saveDownstreamLock(target, { ...lock, excluded: ['ghost-rule'] })

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.ok).toBe(true)
    expect(result.rows).toEqual([
      { rule: 'constitution', state: 'synced' },
      { rule: 'ghost-rule', state: 'excluded' },
    ])
    expect(result.exitCode).toBe(0)
  })

  test('status no longer runs composition validation; a bogus profile rule surfaces as available, not a failure', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(source, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution', 'ghost'] } }))

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.ok).toBe(true)
    expect(result.rows).toEqual([
      { rule: 'constitution', state: 'synced' },
      { rule: 'ghost', state: 'available' },
    ])
    expect(result.exitCode).toBe(0)
  })

  test('upstream profile deleted entirely -> available section is empty, no error', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(source, 'profiles.json'), JSON.stringify({}))

    const result = await statusReport(ctxWith(), { source, target })

    expect(result.ok).toBe(true)
    expect(result.rows).toEqual([{ rule: 'constitution', state: 'synced' }])
    expect(result.exitCode).toBe(0)
  })

  test('project status surfaces duplicates without affecting exit code', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    const fakeHome = mkdtempSync(join(tmpdir(), 'iuse-report-home-'))
    mkdirSync(join(fakeHome, '.claude', 'rules'), { recursive: true })
    writeFileSync(join(fakeHome, '.claude', 'rules', 'constitution.md'), '# Constitution\n')

    const result = await statusReport(ctxWith(undefined, { home: fakeHome }), { source, target })

    expect(result.duplicates).toEqual(['constitution'])
    expect(result.exitCode).toBe(0)
  })
})
