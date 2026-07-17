import { join } from 'node:path'
import { writeFileAtomic } from '@infra-ai/meta-cli/core'
import { planAssembly } from './assemble'
import type { ActionStep, IuseContext } from './init'
import { computeDrift, loadDownstreamLock, localHashFor, ruleTargetRelPath, saveDownstreamLock } from './manifest'
import type { DownstreamLock } from './manifest'
import { resolveSource } from './source'

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message }
}

function formatSteps(steps: ActionStep[]): string {
  return steps.map((s) => (s.note === undefined ? `${s.op} ${s.target}` : `${s.op} ${s.target} (${s.note})`)).join('\n')
}

interface UpdatePlan {
  source: Awaited<ReturnType<typeof resolveSource>>
  lock: DownstreamLock
  items: ReturnType<typeof planAssembly>['items']
  steps: ActionStep[]
  nextRules: Record<string, string>
}

async function planUpdate(
  ctx: IuseContext,
  opts: { source?: string; target: string; force: boolean },
): Promise<{ ok: true; plan: UpdatePlan } | { ok: false; message: string }> {
  const lock = loadDownstreamLock(opts.target)
  if (lock === null) {
    return fail(`${opts.target}: not initialized, run 'iuse init' first`)
  }

  let source: Awaited<ReturnType<typeof resolveSource>>
  try {
    source = await resolveSource({
      explicit: opts.source,
      envRoot: ctx.env.INFRA_AI_ROOT,
      homeDefault: join(ctx.home, 'code/infra-ai'),
      cacheDir: ctx.cacheDir,
      download: ctx.download,
      run: ctx.run,
    })
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }

  let items: ReturnType<typeof planAssembly>['items']
  let violations: ReturnType<typeof planAssembly>['violations']
  try {
    ;({ items, violations } = planAssembly(source.root, lock.profile))
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
  if (violations.length > 0) {
    return fail(`composition violations for profile '${lock.profile}':\n${violations.map((v) => `  - ${v}`).join('\n')}`)
  }

  const sourceByRule = new Map(items.map((i) => [i.rule, i]))
  const steps: ActionStep[] = []
  const nextRules: Record<string, string> = { ...lock.rules }

  for (const [rule, baselineHash] of Object.entries(lock.rules).toSorted(([a], [b]) => a.localeCompare(b))) {
    const item = sourceByRule.get(rule)
    const targetRelPath = ruleTargetRelPath(rule)
    if (item === undefined) {
      // Removed from the profile/source: the lock entry is dropped so `status`
      // stops flagging a rule that will never sync again, but the local file
      // is left alone -- manual cleanup, per spec ("报告但不删除本地副本" protects
      // the file, not the lock bookkeeping).
      delete nextRules[rule]
      steps.push({ op: 'drop', target: targetRelPath, note: 'removed from source profile, local copy kept (manual cleanup)' })
      continue
    }

    const localHash = localHashFor(opts.target, rule)
    const state = computeDrift(localHash, baselineHash, item.hash)

    if (state === 'synced') {
      steps.push({ op: 'synced', target: targetRelPath })
      continue
    }

    if (state === 'outdated') {
      steps.push({ op: 'apply', target: targetRelPath, note: 'updated' })
      continue
    }

    // state is 'modified' or 'missing'
    if (!opts.force) {
      steps.push({ op: state === 'modified' ? 'skip-modified' : 'skip-missing', target: targetRelPath, note: `${state} locally, skipped (use --force to overwrite)` })
      continue
    }
    steps.push({ op: 'apply', target: targetRelPath, note: `${state} locally, overwritten (--force)` })
  }

  for (const rule of [...sourceByRule.keys()].toSorted()) {
    if (rule in lock.rules) continue
    const item = sourceByRule.get(rule)
    if (item === undefined) continue
    steps.push({ op: 'add', target: item.targetRelPath })
  }

  return { ok: true, plan: { source, lock, items, steps, nextRules } }
}

export async function runUpdate(
  ctx: IuseContext,
  opts: { source?: string; target: string; force: boolean; dryRun?: boolean },
): Promise<{ ok: boolean; message: string; steps?: ActionStep[] }> {
  const planned = await planUpdate(ctx, opts)
  if (!planned.ok) return planned

  const { plan } = planned

  if (opts.dryRun === true) {
    const message = plan.steps.length > 0 ? formatSteps(plan.steps) : 'already up to date'
    return { ok: true, message, steps: plan.steps }
  }

  const { source, lock, items, steps, nextRules } = plan
  const sourceByRule = new Map(items.map((i) => [i.rule, i]))
  const notes: string[] = []

  for (const step of steps) {
    if (step.op === 'synced') continue

    if (step.op === 'drop') {
      const rule = ruleFromTargetRelPath(step.target)
      delete nextRules[rule]
      notes.push(`${rule}: ${step.note}`)
      continue
    }

    if (step.op === 'apply') {
      const rule = ruleFromTargetRelPath(step.target)
      const item = sourceByRule.get(rule)
      if (item === undefined) continue
      writeFileAtomic(join(opts.target, item.targetRelPath), item.content)
      nextRules[rule] = item.hash
      notes.push(`${rule}: ${step.note}`)
      continue
    }

    if (step.op === 'add') {
      const rule = ruleFromTargetRelPath(step.target)
      const item = sourceByRule.get(rule)
      if (item === undefined) continue
      writeFileAtomic(join(opts.target, item.targetRelPath), item.content)
      nextRules[rule] = item.hash
      notes.push(`${rule}: added`)
      continue
    }

    // skip-modified / skip-missing
    const rule = ruleFromTargetRelPath(step.target)
    notes.push(`${rule}: ${step.note}`)
  }

  saveDownstreamLock(opts.target, {
    source: { type: source.version.type, id: source.version.id, locator: source.locator },
    profile: lock.profile,
    appliedAt: ctx.now(),
    rules: nextRules,
    templates: lock.templates,
  })

  const message = notes.length > 0 ? notes.join('\n') : 'already up to date'
  return { ok: true, message, steps }
}

function ruleFromTargetRelPath(targetRelPath: string): string {
  return targetRelPath.replace(/^\.claude\/rules\//u, '').replace(/\.md$/u, '')
}
