import { join } from 'node:path'
import { writeFileAtomic } from '@infra-ai/meta-cli/core'
import { planAssembly } from './assemble'
import type { IuseContext } from './init'
import { computeDrift, loadDownstreamLock, localHashFor, ruleTargetRelPath, saveDownstreamLock } from './manifest'
import { resolveSource } from './source'

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message }
}

export async function runUpdate(
  ctx: IuseContext,
  opts: { source?: string; target: string; force: boolean },
): Promise<{ ok: boolean; message: string }> {
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
  const notes: string[] = []
  const nextRules: Record<string, string> = { ...lock.rules }

  for (const [rule, baselineHash] of Object.entries(lock.rules).toSorted(([a], [b]) => a.localeCompare(b))) {
    const item = sourceByRule.get(rule)
    if (item === undefined) {
      // Removed from the profile/source: the lock entry is dropped so `status`
      // stops flagging a rule that will never sync again, but the local file
      // is left alone -- manual cleanup, per spec ("报告但不删除本地副本" protects
      // the file, not the lock bookkeeping).
      delete nextRules[rule]
      notes.push(`${rule}: removed from source profile, local copy kept at ${ruleTargetRelPath(rule)} (manual cleanup)`)
      continue
    }

    const localHash = localHashFor(opts.target, rule)
    const state = computeDrift(localHash, baselineHash, item.hash)
    const targetPath = join(opts.target, item.targetRelPath)

    if (state === 'synced') continue

    if (state === 'outdated') {
      writeFileAtomic(targetPath, item.content)
      nextRules[rule] = item.hash
      notes.push(`${rule}: updated`)
      continue
    }

    // state is 'modified' or 'missing'
    if (!opts.force) {
      notes.push(`${rule}: ${state} locally, skipped (use --force to overwrite)`)
      continue
    }
    writeFileAtomic(targetPath, item.content)
    nextRules[rule] = item.hash
    notes.push(`${rule}: ${state} locally, overwritten (--force)`)
  }

  for (const rule of [...sourceByRule.keys()].toSorted()) {
    if (rule in lock.rules) continue
    const item = sourceByRule.get(rule)
    if (item === undefined) continue
    writeFileAtomic(join(opts.target, item.targetRelPath), item.content)
    nextRules[rule] = item.hash
    notes.push(`${rule}: added`)
  }

  saveDownstreamLock(opts.target, {
    source: { type: source.version.type, id: source.version.id, locator: source.locator },
    profile: lock.profile,
    appliedAt: ctx.now(),
    rules: nextRules,
    templates: lock.templates,
  })

  const message = notes.length > 0 ? notes.join('\n') : 'already up to date'
  return { ok: true, message }
}
