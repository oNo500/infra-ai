import { join } from 'node:path'
import { loadCatalog, loadProfiles, readTextIfExists, sha256 } from '@infra-ai/meta-cli/core'
import type { CatalogRule } from '@infra-ai/meta-cli/core'
import type { IuseContext } from './init'
import { computeDrift, loadDownstreamLock, localHashFor } from './manifest'
import type { DriftState } from './manifest'
import { resolveSource } from './source'

export interface ListRow {
  name: string
  description: string
  tags: string[]
  scope: string
  state?: DriftState | 'uninstalled' | 'broken' // 未初始化目标无 state；broken=catalog 指向的产物缺失
}

export interface ListResult {
  ok: boolean
  message?: string
  rows: ListRow[]
  exitCode: number
}

function matchesGrep(name: string, rule: CatalogRule, sourceRoot: string, grep: string): boolean {
  if (name.includes(grep) || rule.description.includes(grep)) return true
  const content = readTextIfExists(join(sourceRoot, rule.path))
  return content !== null && content.includes(grep)
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

  const rows: ListRow[] = []
  for (const [name, rule] of Object.entries(catalog.rules).toSorted(([a], [b]) => a.localeCompare(b))) {
    if (opts.tags !== undefined && !opts.tags.every((t) => rule.tags.includes(t))) continue
    if (opts.grep !== undefined && !matchesGrep(name, rule, source.root, opts.grep)) continue

    const sourceContent = readTextIfExists(join(source.root, rule.path))
    const artifactPresent = sourceContent !== null

    let state: ListRow['state']
    if (lock !== null) {
      if (!artifactPresent) {
        state = 'broken'
      } else if (Object.hasOwn(lock.rules, name)) {
        const localHash = localHashFor(opts.target, name)
        const baselineHash = lock.rules[name]
        const sourceHash = sha256(sourceContent)
        state = baselineHash === undefined ? 'missing' : computeDrift(localHash, baselineHash, sourceHash)
      } else if ((lock.excluded ?? []).includes(name)) {
        state = 'excluded'
      } else if (lock.profile !== '-' && (loadProfiles(source.root)[lock.profile]?.rules ?? []).includes(name)) {
        state = 'available'
      } else {
        state = 'uninstalled'
      }
    } else if (!artifactPresent) {
      state = 'broken'
    }

    rows.push({ name, description: rule.description, tags: rule.tags, scope: rule.scope, state })
  }

  return { ok: true, rows, exitCode: 0 }
}
