import { join } from 'node:path'
import { loadCatalog, loadProfiles } from './contract'
import type { CatalogRule } from './contract'
import { readTextIfExists } from './io'
import type { IuseContext } from './init'
import { installStateFor } from './list'
import type { InstallState } from './list'
import { loadDownstreamLock } from './manifest'
import { resolveSource } from './source'
import { detectSourceRoot } from './source-root'

export interface ShowResult {
  ok: boolean
  message?: string
  entry?: CatalogRule & { name: string; state?: InstallState }
  content?: string
  exitCode: number
}

export async function showReport(
  ctx: IuseContext,
  opts: { source?: string; target: string; name: string },
): Promise<ShowResult> {
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
    return { ok: false, message: error instanceof Error ? error.message : String(error), exitCode: 1 }
  }

  const { catalogRoot, artifactBase } = detectSourceRoot(source.root)
  const catalog = loadCatalog(catalogRoot)
  if (catalog === null) {
    return {
      ok: false,
      message: `${source.root}: catalog.json missing, run 'imeta catalog' in the source`,
      exitCode: 1,
    }
  }

  const rule = catalog.rules[opts.name]
  if (rule === undefined) {
    const known = Object.keys(catalog.rules).toSorted()
    return {
      ok: false,
      message: `unknown rule '${opts.name}' (known rules: ${known.join(', ')})`,
      exitCode: 1,
    }
  }

  const content = readTextIfExists(join(artifactBase, rule.path))
  const lock = loadDownstreamLock(opts.target)
  const profiles = loadProfiles(source.root)
  const state = installStateFor({ name: opts.name, target: opts.target, sourceContent: content, lock, profiles })

  return {
    ok: true,
    entry: { ...rule, name: opts.name, state },
    content: content ?? undefined,
    exitCode: 0,
  }
}

/**
 * cat 是 show 的管道原语形态：只返回产物原文（即安装形态），供重定向落盘。
 */
export async function catReport(
  ctx: IuseContext,
  opts: { source?: string; name: string },
): Promise<{ ok: boolean; message?: string; content?: string; exitCode: number }> {
  const result = await showReport(ctx, { source: opts.source, target: process.cwd(), name: opts.name })
  if (!result.ok || result.content === undefined) {
    return { ok: false, message: result.message ?? `rule '${opts.name}' has no built artifact`, exitCode: 1 }
  }
  return { ok: true, content: result.content, exitCode: 0 }
}
