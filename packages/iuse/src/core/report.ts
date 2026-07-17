import { join } from 'node:path'
import { readTextIfExists, sha256 } from '@infra-ai/meta-cli/core'
import { planAssembly } from './assemble'
import type { IuseContext } from './init'
import { computeDrift, loadDownstreamLock } from './manifest'
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

function localHashFor(target: string, rule: string): string | null {
  const content = readTextIfExists(join(target, `.claude/rules/${rule}.md`))
  return content === null ? null : sha256(content)
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

  const source = await resolveSource({
    explicit: opts.source,
    envRoot: ctx.env.INFRA_AI_ROOT,
    homeDefault: join(ctx.home, 'code/infra-ai'),
    cacheDir: ctx.cacheDir,
    download: ctx.download,
    run: ctx.run,
  })

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
  for (const [rule, baselineHash] of Object.entries(lock.rules).toSorted(([a], [b]) => a.localeCompare(b))) {
    const localHash = localHashFor(opts.target, rule)
    const sourceHash = sourceHashByRule.get(rule) ?? null
    rows.push({ rule, state: computeDrift(localHash, baselineHash, sourceHash) })
  }

  // Rules that the profile gained in the source since the lock was last applied
  // have no baseline to diff against yet -- they need to be pulled in, so we
  // surface them as 'outdated' (the same state 'iuse update' will resolve by
  // copying them in and registering them in the lock).
  for (const rule of [...sourceHashByRule.keys()].toSorted()) {
    if (rule in lock.rules) continue
    rows.push({ rule, state: 'outdated' })
  }

  rows.sort((a, b) => a.rule.localeCompare(b.rule))

  const exitCode = rows.some((r) => r.state !== 'synced') ? 1 : 0
  return { ok: true, rows, exitCode }
}
