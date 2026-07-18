import { join } from 'node:path'
import { planAssembly } from './assemble'
import type { IuseContext } from './init'
import { computeDrift, loadDownstreamLock, localHashFor } from './manifest'
import type { DriftState } from './manifest'
import { resolveSource } from './source'

export interface StatusRow {
  rule: string
  state: DriftState
}

export interface StatusResult {
  ok: boolean
  message?: string
  rows: StatusRow[]
  exitCode: number
}

export async function statusReport(
  ctx: IuseContext,
  opts: { source?: string; target: string },
): Promise<StatusResult> {
  const lock = loadDownstreamLock(opts.target)
  if (lock === null) {
    return {
      ok: false,
      message: `${opts.target}: not initialized, run 'iuse init' first`,
      rows: [],
      exitCode: 1,
    }
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
    return { ok: false, message: error instanceof Error ? error.message : String(error), rows: [], exitCode: 1 }
  }

  let items: ReturnType<typeof planAssembly>['items']
  let violations: ReturnType<typeof planAssembly>['violations']
  try {
    ;({ items, violations } = planAssembly(source.root, lock.profile))
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error), rows: [], exitCode: 1 }
  }
  if (violations.length > 0) {
    return {
      ok: false,
      message: `composition violations for profile '${lock.profile}':\n${violations.map((v) => `  - ${v}`).join('\n')}`,
      rows: [],
      exitCode: 1,
    }
  }

  const sourceHashByRule = new Map(items.map((i) => [i.rule, i.hash]))

  const rows: StatusRow[] = []
  for (const [rule, baselineHash] of Object.entries(lock.rules)) {
    const localHash = localHashFor(opts.target, rule)
    const sourceHash = sourceHashByRule.get(rule) ?? null
    rows.push({ rule, state: computeDrift(localHash, baselineHash, sourceHash) })
  }

  const excluded = lock.excluded ?? []
  const excludedSet = new Set(excluded)

  // Rules that the profile gained in the source since the lock was last applied
  // have no baseline to diff against yet -- they need to be pulled in, so we
  // surface them as 'outdated' (the same state 'iuse update' will resolve by
  // copying them in and registering them in the lock). A rule the downstream
  // explicitly excluded is a permanent gate, not a pending pull -- it reports
  // 'excluded' instead and never reverts to 'outdated'.
  for (const rule of sourceHashByRule.keys()) {
    if (rule in lock.rules) continue
    if (excludedSet.has(rule)) continue
    rows.push({ rule, state: 'outdated' })
  }

  for (const rule of excluded) {
    rows.push({ rule, state: 'excluded' })
  }

  rows.sort((a, b) => a.rule.localeCompare(b.rule))

  const exitCode = rows.some((r) => r.state !== 'synced' && r.state !== 'excluded') ? 1 : 0
  return { ok: true, rows, exitCode }
}
