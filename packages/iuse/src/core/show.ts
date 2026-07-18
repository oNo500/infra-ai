import { join } from 'node:path'
import { loadCatalog, loadProfiles, readTextIfExists } from '@infra-ai/meta-cli/core'
import type { CatalogRule } from '@infra-ai/meta-cli/core'
import type { IuseContext } from './init'
import { installStateFor } from './list'
import type { InstallState } from './list'
import { loadDownstreamLock } from './manifest'
import { resolveSource } from './source'

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

  const catalog = loadCatalog(source.root)
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

  const content = readTextIfExists(join(source.root, rule.path))
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
