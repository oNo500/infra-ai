import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { writeFileAtomic } from './io'
import { assembleRules } from './assemble'
import type { ActionStep, IuseContext } from './init'
import { formatSteps } from './init'
import { computeDrift, loadDownstreamLock, localHashFor, ruleTargetRelPath, saveDownstreamLock } from './manifest'
import type { DownstreamLock } from './manifest'
import { resolveSource } from './source'

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message }
}

interface UpdatePlan {
  source: Awaited<ReturnType<typeof resolveSource>>
  lock: DownstreamLock
  items: ReturnType<typeof assembleRules>['items']
  steps: ActionStep[]
  nextRules: Record<string, string>
  nextExcluded: string[]
}

async function planUpdate(
  ctx: IuseContext,
  opts: { source?: string; target: string; force: boolean; add?: string[]; remove?: string[]; overwrite?: string[] },
): Promise<{ ok: true; plan: UpdatePlan } | { ok: false; message: string }> {
  const lock = loadDownstreamLock(opts.target)
  if (lock === null) {
    return fail(`${opts.target}: not initialized, run 'iuse init' first`)
  }

  const currentlyExcluded = lock.excluded ?? []
  const currentlyExcludedSet = new Set(currentlyExcluded)
  const locked = Object.keys(lock.rules)

  const add = [...new Set(opts.add ?? [])]
  const remove = [...new Set(opts.remove ?? [])]

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

  let items: ReturnType<typeof assembleRules>['items']
  let missing: ReturnType<typeof assembleRules>['missing']
  let violations: ReturnType<typeof assembleRules>['violations']
  try {
    ;({ items, missing, violations } = assembleRules(source.root, [...locked, ...add]))
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
  const missingSet = new Set(missing)

  if (add.length > 0) {
    const unknown = add.filter((rule) => missingSet.has(rule))
    if (unknown.length > 0) {
      return fail(`unknown rules in --add: ${unknown.join(', ')}`)
    }
    const addSetForViolations = new Set(add)
    const addViolations = violations.filter((v) => {
      const parts = v.split(':')
      const ruleName = parts[0]
      return ruleName !== undefined && addSetForViolations.has(ruleName)
    })
    if (addViolations.length > 0) {
      return fail(addViolations.join('\n'))
    }
    const alreadyInstalled = add.filter((rule) => Object.hasOwn(lock.rules, rule) && !currentlyExcludedSet.has(rule))
    if (alreadyInstalled.length > 0) {
      return fail(`already installed: ${alreadyInstalled.join(', ')}`)
    }
  }

  if (remove.length > 0) {
    const notInstalled = remove.filter((rule) => !Object.hasOwn(lock.rules, rule))
    if (notInstalled.length > 0) {
      return fail(`not installed: ${notInstalled.join(', ')}`)
    }
  }

  const addSet = new Set(add)
  const removeSet = new Set(remove)
  // add ∩ excluded 走 re-include 路径（op 仍叫 include）；add − excluded 走 add 路径。
  const includeSet = new Set([...addSet].filter((rule) => currentlyExcludedSet.has(rule)))
  const freshAddSet = new Set([...addSet].filter((rule) => !currentlyExcludedSet.has(rule)))
  const overwriteSet = new Set(opts.overwrite ?? [])

  const sourceByRule = new Map(items.map((i) => [i.rule, i]))
  const steps: ActionStep[] = []
  const nextRules: Record<string, string> = { ...lock.rules }

  for (const [rule, baselineHash] of Object.entries(lock.rules).toSorted(([a], [b]) => a.localeCompare(b))) {
    const targetRelPath = ruleTargetRelPath(rule)

    if (removeSet.has(rule)) {
      steps.push({ op: 'remove', target: targetRelPath, note: 'removed and excluded' })
      continue
    }

    const item = sourceByRule.get(rule)
    if (item === undefined) {
      // The underlying asset itself is gone from the source (assembleRules
      // 'missing'), not merely dropped from a profile -- the lock entry is
      // dropped so `status` stops flagging a rule that will never sync again,
      // but the local file is left alone -- manual cleanup, per spec
      // ("报告但不删除本地副本" protects the file, not the lock bookkeeping).
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
    if (state === 'modified' && overwriteSet.has(rule)) {
      steps.push({ op: 'apply', target: targetRelPath, note: '(overwrite)' })
      continue
    }
    if (!opts.force) {
      steps.push({ op: state === 'modified' ? 'skip-modified' : 'skip-missing', target: targetRelPath, note: `${state} locally, skipped (use --force to overwrite)` })
      continue
    }
    steps.push({ op: 'apply', target: targetRelPath, note: `${state} locally, overwritten (--force)` })
  }

  const nextExcluded = [...currentlyExcluded]

  // add − excluded: explicit additions, not previously excluded.
  for (const rule of [...freshAddSet].toSorted()) {
    const item = sourceByRule.get(rule)
    if (item === undefined) continue
    steps.push({ op: 'add', target: item.targetRelPath })
  }

  // Excluded rules are a permanent gate: they produce zero steps unless the
  // caller names them in --add, at which point re-inclusion is itself a
  // clean-copy vs. differing-content decision (mirrors the modified/outdated split above).
  for (const rule of [...currentlyExcludedSet].toSorted()) {
    const targetRelPath = ruleTargetRelPath(rule)
    if (!includeSet.has(rule)) continue

    const item = sourceByRule.get(rule)
    if (item === undefined) continue // source dropped the rule entirely -- nothing to re-include

    const localHash = localHashFor(opts.target, rule)
    const isClean = localHash === null || localHash === item.hash
    if (isClean || opts.force || overwriteSet.has(rule)) {
      const note = isClean ? undefined : '(overwrite)'
      steps.push(note === undefined ? { op: 'include', target: targetRelPath } : { op: 'include', target: targetRelPath, note })
      continue
    }

    steps.push({
      op: 'skip-include',
      target: targetRelPath,
      note: "local differs, kept (see 'iuse diff --rule <name>', use --force to overwrite)",
    })
  }

  return { ok: true, plan: { source, lock, items, steps, nextRules, nextExcluded } }
}

export async function runUpdate(
  ctx: IuseContext,
  opts: {
    source?: string
    target: string
    force: boolean
    dryRun?: boolean
    add?: string[]
    remove?: string[]
    overwrite?: string[]
    onProgress?: (step: ActionStep) => void
  },
): Promise<{ ok: boolean; message: string; steps?: ActionStep[] }> {
  const planned = await planUpdate(ctx, opts)
  if (!planned.ok) return planned

  const { plan } = planned

  if (opts.dryRun === true) {
    const message = plan.steps.length > 0 ? formatSteps(plan.steps) : 'already up to date'
    return { ok: true, message, steps: plan.steps }
  }

  const { source, lock, items, steps, nextRules, nextExcluded } = plan
  const sourceByRule = new Map(items.map((i) => [i.rule, i]))
  const excludedAfter = new Set(nextExcluded)
  const notes: string[] = []

  for (const step of steps) {
    if (step.op === 'synced') continue

    opts.onProgress?.(step)

    if (step.op === 'drop') {
      const rule = ruleFromTargetRelPath(step.target)
      delete nextRules[rule]
      notes.push(`${rule}: ${step.note}`)
      continue
    }

    if (step.op === 'remove') {
      const rule = ruleFromTargetRelPath(step.target)
      rmSync(join(opts.target, step.target), { force: true })
      delete nextRules[rule]
      excludedAfter.add(rule)
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

    if (step.op === 'include') {
      const rule = ruleFromTargetRelPath(step.target)
      const item = sourceByRule.get(rule)
      if (item === undefined) continue
      writeFileAtomic(join(opts.target, item.targetRelPath), item.content)
      nextRules[rule] = item.hash
      excludedAfter.delete(rule)
      notes.push(`${rule}: included${step.note === undefined ? '' : ` ${step.note}`}`)
      continue
    }

    // skip-modified / skip-missing / skip-include
    const rule = ruleFromTargetRelPath(step.target)
    notes.push(`${rule}: ${step.note}`)
  }

  saveDownstreamLock(opts.target, {
    source: { type: source.version.type, id: source.version.id, locator: source.locator },
    profile: lock.profile,
    appliedAt: ctx.now(),
    rules: nextRules,
    templates: lock.templates,
    excluded: [...excludedAfter].toSorted(),
  })

  const message = notes.length > 0 ? notes.join('\n') : 'already up to date'
  return { ok: true, message, steps }
}

function ruleFromTargetRelPath(targetRelPath: string): string {
  return targetRelPath.replace(/^\.claude\/rules\//u, '').replace(/\.md$/u, '')
}
