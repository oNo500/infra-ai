import { join } from 'node:path'
import { readTextIfExists, sha256, writeFileAtomic } from '@infra-ai/meta-cli/core'
import { planAssembly } from './assemble'
import type { IuseContext } from './init'
import { computeDrift, loadDownstreamLock, saveDownstreamLock } from './manifest'
import { resolveSource } from './source'

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message }
}

function localHashFor(target: string, rule: string): string | null {
  const content = readTextIfExists(join(target, `.claude/rules/${rule}.md`))
  return content === null ? null : sha256(content)
}

export async function runUpdate(
  ctx: IuseContext,
  opts: { source?: string; target: string; force: boolean },
): Promise<{ ok: boolean; message: string }> {
  const lock = loadDownstreamLock(opts.target)
  if (lock === null) {
    return fail(`${opts.target}: not initialized, run 'iuse init' first`)
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
      // Removed from the profile/source: leave the local copy alone (manual
      // cleanup) and keep the stale lock entry so status keeps flagging it.
      notes.push(`${rule}: removed from source profile, local copy kept (remove manually if no longer needed)`)
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
