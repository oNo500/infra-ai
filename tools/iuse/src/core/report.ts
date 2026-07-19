import { join } from 'node:path'
import { loadProfiles } from './contract'
import { readTextIfExists } from './io'
import { assembleRules } from './assemble'
import type { IuseContext } from './init'
import { computeDrift, loadDownstreamLock, localHashFor, ruleTargetRelPath } from './manifest'
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
  duplicates?: string[]
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

  const locked = Object.keys(lock.rules)
  let items: ReturnType<typeof assembleRules>['items']
  try {
    ;({ items } = assembleRules(source.root, locked))
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error), rows: [], exitCode: 1 }
  }
  // missing 的 rule（源端资产整个消失）落 sourceHash=null，走下面同一套 computeDrift
  // 循环，呈现为 outdated/missing——与现状行为一致，这里不需要特殊分支。
  const sourceHashByRule = new Map(items.map((i) => [i.rule, i.hash]))

  const rows: StatusRow[] = []
  for (const [rule, baselineHash] of Object.entries(lock.rules)) {
    const localHash = localHashFor(opts.target, rule)
    const sourceHash = sourceHashByRule.get(rule) ?? null
    rows.push({ rule, state: computeDrift(localHash, baselineHash, sourceHash) })
  }

  const excluded = lock.excluded ?? []
  const excludedSet = new Set(excluded)

  for (const rule of excluded) {
    rows.push({ rule, state: 'excluded' })
  }

  // lock.rules is the SSoT for what's installed; the profile is only an init
  // seed. A rule the source profile carries that isn't in lock.rules yet (and
  // isn't excluded) is merely on offer -- surfaced as 'available' so status
  // never auto-implies it should be pulled. If the profile itself has since
  // vanished upstream, this section is simply empty -- the seed reference was
  // informational, not a standing dependency.
  if (lock.profile !== '-') {
    const profileRules = loadProfiles(source.root)[lock.profile]?.rules ?? []
    for (const rule of profileRules) {
      if (Object.hasOwn(lock.rules, rule)) continue
      if (excludedSet.has(rule)) continue
      rows.push({ rule, state: 'available' })
    }
  }

  rows.sort((a, b) => a.rule.localeCompare(b.rule))

  // A rule installed at the project scope (lock.rules) that is *also* present
  // at the global scope ($HOME/.claude/rules) is a duplicate worth flagging --
  // informational only, it never affects exitCode.
  const duplicates = Object.keys(lock.rules)
    .toSorted()
    .filter((rule) => readTextIfExists(join(ctx.home, ruleTargetRelPath(rule))) !== null)

  const exitCode = rows.some((r) => r.state !== 'synced' && r.state !== 'excluded' && r.state !== 'available') ? 1 : 0
  return { ok: true, rows, duplicates, exitCode }
}
