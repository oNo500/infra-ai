import { join } from 'node:path'
import { loadCatalog, loadProfiles, readTextIfExists, sha256 } from '@infra-ai/meta-cli/core'
import type { CatalogRule, Profiles } from '@infra-ai/meta-cli/core'
import type { IuseContext } from './init'
import { computeDrift, loadDownstreamLock, localHashFor } from './manifest'
import type { DownstreamLock, DriftState } from './manifest'
import { resolveSource } from './source'

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

  const catalog = loadCatalog(source.root)
  if (catalog === null) {
    return {
      ok: false,
      message: `${source.root}: catalog.json missing, run 'imeta catalog' in the source`,
      rows: [],
      exitCode: 1,
    }
  }

  const lock = loadDownstreamLock(opts.target)
  const profiles = loadProfiles(source.root)
  const grepLower = opts.grep?.toLowerCase()

  const rows: ListRow[] = []
  for (const [name, rule] of Object.entries(catalog.rules).toSorted(([a], [b]) => a.localeCompare(b))) {
    if (opts.tags !== undefined && !opts.tags.every((t) => rule.tags.includes(t))) continue

    const sourceContent = readTextIfExists(join(source.root, rule.path))
    if (grepLower !== undefined && !matchesGrep(name, rule, sourceContent, grepLower)) continue

    const state = installStateFor({ name, target: opts.target, sourceContent, lock, profiles })

    rows.push({ name, description: rule.description, tags: rule.tags, scope: rule.scope, state })
  }

  return { ok: true, rows, exitCode: 0 }
}
