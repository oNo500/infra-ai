import { join } from 'node:path'
import { loadCatalog, loadProfiles } from './contract'
import type { Catalog, CatalogRule, Profiles } from './contract'
import { readTextIfExists, sha256 } from './io'
import type { IuseContext } from './init'
import { computeDrift, loadDownstreamLock, localHashFor } from './manifest'
import type { DownstreamLock, DriftState } from './manifest'
import { renderRule } from './render'
import { resolveSource } from './source'
import { detectSourceRoot } from './source-root'

export type InstallState = DriftState | 'uninstalled' | 'broken'

export interface ListRow {
  name: string
  description: string
  tags: string[]
  scope: string
  state?: InstallState // 未初始化目标无 state；broken=catalog 指向的产物缺失
}

export interface ListResult {
  ok: boolean
  message?: string
  rows: ListRow[]
  exitCode: number
}

/**
 * Single source of truth for a rule's install-state annotation, shared by
 * `list` (every catalog row) and `show` (one row). broken (source-side
 * artifact missing) takes priority regardless of lock presence; otherwise
 * an uninitialized target (lock === null) yields undefined -- no state to report.
 */
export function installStateFor(opts: {
  name: string
  target: string
  sourceContent: string | null
  lock: DownstreamLock | null
  profiles: Profiles
}): InstallState | undefined {
  const { name, target, sourceContent, lock, profiles } = opts
  const artifactPresent = sourceContent !== null

  if (lock === null) return artifactPresent ? undefined : 'broken'
  if (!artifactPresent) return 'broken'

  if (Object.hasOwn(lock.rules, name)) {
    const localHash = localHashFor(target, name)
    const baselineHash = lock.rules[name]
    const sourceHash = sha256(sourceContent)
    return baselineHash === undefined ? 'missing' : computeDrift(localHash, baselineHash, sourceHash)
  }
  if ((lock.excluded ?? []).includes(name)) return 'excluded'
  if (lock.profile !== '-' && (profiles[lock.profile]?.rules ?? []).includes(name)) return 'available'
  return 'uninstalled'
}

// 大小写不敏感：name/description/正文统一 toLowerCase 后子串匹配（调用方传入已 toLowerCase 的 grep）
function matchesGrep(name: string, rule: CatalogRule, content: string | null, grepLower: string): boolean {
  if (name.toLowerCase().includes(grepLower) || rule.description.toLowerCase().includes(grepLower)) return true
  return content !== null && content.toLowerCase().includes(grepLower)
}

/**
 * Shared tags/grep filter + row-building loop for list -- install state is
 * computed via a caller-supplied callback.
 */
function buildFilteredRows(opts: {
  artifactBase: string
  catalogRules: Catalog['rules']
  tags?: string[]
  grepLower?: string
  computeState: (name: string, rule: CatalogRule, sourceContent: string | null) => ListRow['state']
}): ListRow[] {
  const { artifactBase, catalogRules, tags, grepLower, computeState } = opts
  const rows: ListRow[] = []
  for (const [name, rule] of Object.entries(catalogRules).toSorted(([a], [b]) => a.localeCompare(b))) {
    if (tags !== undefined && !tags.every((t) => rule.tags.includes(t))) continue

    const raw = readTextIfExists(join(artifactBase, rule.path))
    const sourceContent = raw === null ? null : renderRule(rule.scope, raw)
    if (grepLower !== undefined && !matchesGrep(name, rule, sourceContent, grepLower)) continue

    const state = computeState(name, rule, sourceContent)
    rows.push({ name, description: rule.description, tags: rule.tags, scope: rule.scope, state })
  }
  return rows
}

export async function listReport(
  ctx: IuseContext,
  opts: { source?: string; target: string; tags?: string[]; grep?: string },
): Promise<ListResult> {
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

  const { catalogRoot, artifactBase } = detectSourceRoot(source.root)
  const catalog = loadCatalog(catalogRoot)
  if (catalog === null) {
    return {
      ok: false,
      message: `${source.root}: catalog.json missing, run 'imeta catalog' in the source`,
      rows: [],
      exitCode: 1,
    }
  }

  const grepLower = opts.grep?.toLowerCase()

  const lock = loadDownstreamLock(opts.target)
  const profiles = loadProfiles(source.root)

  const rows = buildFilteredRows({
    artifactBase,
    catalogRules: catalog.rules,
    tags: opts.tags,
    grepLower,
    computeState: (name, _rule, sourceContent) => installStateFor({ name, target: opts.target, sourceContent, lock, profiles }),
  })

  return { ok: true, rows, exitCode: 0 }
}
