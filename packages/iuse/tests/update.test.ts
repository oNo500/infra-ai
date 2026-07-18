import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInit } from '../src/core/init'
import type { IuseContext } from '../src/core/init'
import { loadDownstreamLock } from '../src/core/manifest'
import { statusReport } from '../src/core/report'
import { runUpdate } from '../src/core/update'

function fixtureSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'iuse-update-src-'))
  mkdirSync(join(dir, 'meta', 'rules'), { recursive: true })
  mkdirSync(join(dir, 'rules', 'global'), { recursive: true })
  mkdirSync(join(dir, 'templates'), { recursive: true })
  writeFileSync(join(dir, 'meta', 'tags.json'), JSON.stringify({ concern: { exclusive: false, values: { core: 'x' } } }))
  writeFileSync(
    join(dir, 'meta', 'rules', 'constitution.md'),
    '---\nname: constitution\nstatus: ready\nscope: global\ntags: [core]\n---\nbody',
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
    `---\nname: ${name}\nstatus: ready\nscope: global\ntags: [${tags.join(', ')}]\n---\nbody`,
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

function ctxWith(now: () => string = () => '2026-07-17T00:00:00Z'): IuseContext {
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
  const target = mkdtempSync(join(tmpdir(), 'iuse-update-tgt-'))
  const result = await runInit(ctxWith(), { source, profile: 'demo', target, force: false })
  if (!result.ok) throw new Error(`fixture init failed: ${result.message}`)
  return target
}

describe('runUpdate', () => {
  test('no lock at target fails pointing at init', async () => {
    const source = fixtureSource()
    const target = mkdtempSync(join(tmpdir(), 'iuse-update-tgt-'))

    const result = await runUpdate(ctxWith(), { source, target, force: false })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('iuse init')
  })

  test('source resolution failure returns ok:false with the error message instead of throwing', async () => {
    const source = mkdtempSync(join(tmpdir(), 'iuse-update-badsrc-'))
    const target = await initTarget(fixtureSource())

    const result = await runUpdate(ctxWith(), { source, target, force: false })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('profiles.json not found')
  })

  test('rejecting download for a gh: source returns ok:false with the rejection message', async () => {
    const target = await initTarget(fixtureSource())
    const ctx: IuseContext = {
      ...ctxWith(),
      download: async () => {
        throw new Error('network unreachable')
      },
    }

    const result = await runUpdate(ctx, { source: 'gh:someorg/somerepo', target, force: false })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('network unreachable')
  })

  test('outdated + clean local -> writes new content and refreshes the lock hash', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(source, 'rules', 'global', 'constitution.md'), '# Constitution\n\nv2\n')

    const result = await runUpdate(ctxWith(() => '2026-08-01T00:00:00Z'), { source, target, force: false })

    expect(result.ok).toBe(true)
    expect(result.message).toContain('constitution: updated')
    expect(readFileSync(join(target, '.claude/rules/constitution.md'), 'utf8')).toBe('# Constitution\n\nv2\n')
    const lock = loadDownstreamLock(target)
    expect(lock?.rules.constitution).not.toBe(undefined)
    expect(lock?.appliedAt).toBe('2026-08-01T00:00:00Z')
  })

  test('locally modified rule is skipped by default with a warning', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(target, '.claude/rules/constitution.md'), '# Constitution\n\nlocally edited\n')
    writeFileSync(join(source, 'rules', 'global', 'constitution.md'), '# Constitution\n\nv2\n')
    const lockBefore = loadDownstreamLock(target)

    const result = await runUpdate(ctxWith(), { source, target, force: false })

    expect(result.ok).toBe(true)
    expect(result.message).toContain('constitution: modified locally, skipped')
    expect(result.message).toContain('--force')
    expect(readFileSync(join(target, '.claude/rules/constitution.md'), 'utf8')).toBe('# Constitution\n\nlocally edited\n')
    expect(loadDownstreamLock(target)?.rules.constitution).toBe(lockBefore?.rules.constitution)
  })

  test('missing local rule is skipped by default with a warning', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    rmSync(join(target, '.claude/rules/constitution.md'))

    const result = await runUpdate(ctxWith(), { source, target, force: false })

    expect(result.ok).toBe(true)
    expect(result.message).toContain('constitution: missing locally, skipped')
    expect(existsSync(join(target, '.claude/rules/constitution.md'))).toBe(false)
  })

  test('--force overwrites a locally modified rule and refreshes the hash', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(target, '.claude/rules/constitution.md'), '# Constitution\n\nlocally edited\n')
    writeFileSync(join(source, 'rules', 'global', 'constitution.md'), '# Constitution\n\nv2\n')

    const result = await runUpdate(ctxWith(), { source, target, force: true })

    expect(result.ok).toBe(true)
    expect(result.message).toContain('constitution: modified locally, overwritten (--force)')
    expect(readFileSync(join(target, '.claude/rules/constitution.md'), 'utf8')).toBe('# Constitution\n\nv2\n')
  })

  test('--force restores a missing rule', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    rmSync(join(target, '.claude/rules/constitution.md'))

    const result = await runUpdate(ctxWith(), { source, target, force: true })

    expect(result.ok).toBe(true)
    expect(result.message).toContain('constitution: missing locally, overwritten (--force)')
    expect(readFileSync(join(target, '.claude/rules/constitution.md'), 'utf8')).toBe('# Constitution\n')
  })

  test('rule newly added to source profile is copied in and registered in the lock', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])

    const result = await runUpdate(ctxWith(), { source, target, force: false })

    expect(result.ok).toBe(true)
    expect(result.message).toContain('extra: added')
    expect(readFileSync(join(target, '.claude/rules/extra.md'), 'utf8')).toBe('# Extra\n')
    const lock = loadDownstreamLock(target)
    expect(Object.keys(lock?.rules ?? {}).toSorted()).toEqual(['constitution', 'extra'])
  })

  test('rule removed from source profile drops the lock entry but keeps the local copy', async () => {
    const source = fixtureSource()
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])
    const target = await initTarget(source)

    setProfileRules(source, ['constitution'])

    const result = await runUpdate(ctxWith(), { source, target, force: false })

    expect(result.ok).toBe(true)
    expect(result.message).toContain('extra: removed from source profile')
    expect(result.message).toContain('manual cleanup')
    expect(existsSync(join(target, '.claude/rules/extra.md'))).toBe(true)
    expect(loadDownstreamLock(target)?.rules.extra).toBe(undefined)

    // Follow-through: status no longer flags the removed rule at all, and the
    // rest of the target is in sync, so the overall report is a clean exit 0.
    const statusAfter = await statusReport(ctxWith(), { source, target })
    expect(statusAfter.ok).toBe(true)
    expect(statusAfter.rows.some((r) => r.rule === 'extra')).toBe(false)
    expect(statusAfter.exitCode).toBe(0)
  })

  test('lock source id/locator and appliedAt are refreshed; templates list untouched', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    const lockBefore = loadDownstreamLock(target)

    const result = await runUpdate(ctxWith(() => '2026-09-01T00:00:00Z'), { source, target, force: false })

    expect(result.ok).toBe(true)
    const lockAfter = loadDownstreamLock(target)
    expect(lockAfter?.appliedAt).toBe('2026-09-01T00:00:00Z')
    expect(lockAfter?.source.locator).toBe(source)
    expect(lockAfter?.templates).toEqual(lockBefore?.templates)
  })

  test('composition violations fail the update', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(source, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution', 'ghost'] } }))

    const result = await runUpdate(ctxWith(), { source, target, force: false })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('ghost')
  })

  test('already in sync reports up to date and leaves the lock hash unchanged', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    const lockBefore = loadDownstreamLock(target)

    const result = await runUpdate(ctxWith(() => '2026-10-01T00:00:00Z'), { source, target, force: false })

    expect(result.ok).toBe(true)
    expect(result.message).toBe('already up to date')
    expect(loadDownstreamLock(target)?.rules).toEqual(lockBefore?.rules ?? {})
  })

  test('update --dry-run reports per-rule decisions without applying', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    // outdated: change the source content for constitution
    writeFileSync(join(source, 'rules', 'global', 'constitution.md'), '# Constitution\n\nv2\n')
    // modified: also add another rule locally-edited to prove skip-modified
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])
    const preUpdateResult = await runUpdate(ctxWith(), { source, target, force: false })
    expect(preUpdateResult.ok).toBe(true) // extra gets added, constitution gets updated to v2

    // now make local edits + a new source change to create modified + outdated together
    writeFileSync(join(target, '.claude/rules/extra.md'), '# Extra\n\nlocally edited\n')
    writeFileSync(join(source, 'rules', 'global', 'constitution.md'), '# Constitution\n\nv3\n')

    const lockBefore = loadDownstreamLock(target)
    const constitutionBefore = readFileSync(join(target, '.claude/rules/constitution.md'), 'utf8')
    const extraBefore = readFileSync(join(target, '.claude/rules/extra.md'), 'utf8')

    const result = await runUpdate(ctxWith(), { source, target, force: false, dryRun: true })

    expect(result.ok).toBe(true)
    const steps = result.steps ?? []
    expect(steps).toContainEqual(expect.objectContaining({ op: 'apply', target: '.claude/rules/constitution.md' }))
    expect(steps).toContainEqual(expect.objectContaining({ op: 'skip-modified', target: '.claude/rules/extra.md' }))

    // nothing actually applied
    expect(readFileSync(join(target, '.claude/rules/constitution.md'), 'utf8')).toBe(constitutionBefore)
    expect(readFileSync(join(target, '.claude/rules/extra.md'), 'utf8')).toBe(extraBefore)
    expect(loadDownstreamLock(target)).toEqual(lockBefore)

    const lines = result.message.split('\n')
    expect(lines.some((l) => l.startsWith('apply .claude/rules/constitution.md'))).toBe(true)
    expect(lines.some((l) => l.startsWith('skip-modified .claude/rules/extra.md'))).toBe(true)
  })

  test('update --dry-run still fails on composition violations', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(source, 'profiles.json'), JSON.stringify({ demo: { rules: ['constitution', 'ghost'] } }))

    const result = await runUpdate(ctxWith(), { source, target, force: false, dryRun: true })

    expect(result.ok).toBe(false)
    expect(result.message).toContain('ghost')
  })

  test('update --dry-run reports synced when already up to date', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    const lockBefore = loadDownstreamLock(target)

    const result = await runUpdate(ctxWith(), { source, target, force: false, dryRun: true })

    expect(result.ok).toBe(true)
    const steps = result.steps ?? []
    expect(steps).toContainEqual(expect.objectContaining({ op: 'synced', target: '.claude/rules/constitution.md' }))
    expect(loadDownstreamLock(target)).toEqual(lockBefore)
  })

  test('real update still returns steps describing what happened', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(source, 'rules', 'global', 'constitution.md'), '# Constitution\n\nv2\n')
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])

    const result = await runUpdate(ctxWith(), { source, target, force: false })

    expect(result.ok).toBe(true)
    const steps = result.steps ?? []
    expect(steps).toContainEqual(expect.objectContaining({ op: 'apply', target: '.claude/rules/constitution.md' }))
    expect(steps).toContainEqual(expect.objectContaining({ op: 'add', target: '.claude/rules/extra.md' }))
  })

  test('onProgress fires per executed step in order, not in dry-run', async () => {
    const source = fixtureSource()
    const target = await initTarget(source)
    writeFileSync(join(source, 'rules', 'global', 'constitution.md'), '# Constitution\n\nv2\n')
    addRule(source, 'extra', '# Extra\n')
    setProfileRules(source, ['constitution', 'extra'])

    const seenOps: string[] = []
    const onProgress = (step: { op: string; target: string }) => seenOps.push(step.op)

    const result = await runUpdate(ctxWith(), { source, target, force: false, onProgress })

    expect(result.ok).toBe(true)
    const resultOps = (result.steps ?? []).filter((s) => s.op !== 'synced').map((s) => s.op)
    expect(seenOps).toEqual(resultOps)

    // dry-run with onProgress should not fire the callback
    const seenOpsDry: string[] = []
    const onProgressDry = (step: { op: string; target: string }) => seenOpsDry.push(step.op)

    const resultDry = await runUpdate(ctxWith(), { source, target, force: false, dryRun: true, onProgress: onProgressDry })

    expect(resultDry.ok).toBe(true)
    expect(seenOpsDry.length).toBe(0)
  })
})
