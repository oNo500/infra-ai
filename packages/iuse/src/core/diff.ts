import { join } from 'node:path'
import { readTextIfExists } from '@infra-ai/meta-cli/core'
import { createTwoFilesPatch, structuredPatch } from 'diff'
import { assembleRules } from './assemble'
import type { IuseContext } from './init'
import { loadDownstreamLock, ruleTargetRelPath } from './manifest'
import type { DriftState } from './manifest'
import { resolveSource } from './source'

export interface RuleDiff {
  rule: string
  state: DriftState
  additions: number
  deletions: number
  patch?: string
}

export interface DiffResult {
  ok: boolean
  message?: string
  diffs: RuleDiff[]
  exitCode: number
}

function localTextFor(target: string, rule: string): string | null {
  return readTextIfExists(join(target, ruleTargetRelPath(rule)))
}

/**
 * Sums the added/removed line counts across a structured patch's hunks.
 * Each hunk line is a unified-diff row prefixed '+' (addition), '-' (deletion),
 * or ' ' (context) -- context lines are excluded from both counts.
 */
function countChanges(localText: string, sourceText: string): { additions: number; deletions: number } {
  const patch = structuredPatch('local', 'source', localText, sourceText)
  let additions = 0
  let deletions = 0
  for (const hunk of patch.hunks) {
    for (const line of hunk.lines) {
      if (line.startsWith('+')) additions += 1
      else if (line.startsWith('-')) deletions += 1
    }
  }
  return { additions, deletions }
}

function driftStateFor(localText: string | null, sourceText: string): DriftState {
  if (localText === null) return 'missing'
  return localText === sourceText ? 'synced' : 'outdated'
}

export async function diffReport(
  ctx: IuseContext,
  opts: { source?: string; target: string; rule?: string },
): Promise<DiffResult> {
  const lock = loadDownstreamLock(opts.target)
  if (lock === null) {
    return { ok: false, message: `${opts.target}: not initialized, run 'iuse init' first`, diffs: [], exitCode: 1 }
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
    return { ok: false, message: error instanceof Error ? error.message : String(error), diffs: [], exitCode: 1 }
  }

  // diff operates on what's actually installed (lock.rules + excluded), not
  // on the seed profile -- a rules-only target (lock.profile === '-') has no
  // profile to resolve, and a profile target's diff must not fail just
  // because the source profile grew an unrelated bad entry since init.
  const { items, violations } = assembleRules(source.root, [...Object.keys(lock.rules), ...(lock.excluded ?? [])])
  if (violations.length > 0) {
    return {
      ok: false,
      message: `assembly violations:\n${violations.map((v) => `  - ${v}`).join('\n')}`,
      diffs: [],
      exitCode: 1,
    }
  }

  const sourceByRule = new Map(items.map((i) => [i.rule, i]))
  const excluded = lock.excluded ?? []

  if (opts.rule !== undefined) {
    const rule = opts.rule
    const isKnown = Object.hasOwn(lock.rules, rule) || excluded.includes(rule)
    if (!isKnown) {
      const known = [...Object.keys(lock.rules), ...excluded].toSorted()
      return {
        ok: false,
        message: `unknown rule '${rule}' (known rules: ${known.join(', ')})`,
        diffs: [],
        exitCode: 1,
      }
    }

    const item = sourceByRule.get(rule)
    if (item === undefined) {
      return {
        ok: false,
        message: `${rule}: no longer present in profile '${lock.profile}' at the source`,
        diffs: [],
        exitCode: 1,
      }
    }

    const localText = localTextFor(opts.target, rule)
    const sourceText = item.content
    const state = driftStateFor(localText, sourceText)
    const { additions, deletions } = countChanges(localText ?? '', sourceText)
    const patch = createTwoFilesPatch(`${rule} (local)`, `${rule} (source)`, localText ?? '', sourceText)

    return {
      ok: true,
      diffs: [{ rule, state, additions, deletions, patch }],
      exitCode: state === 'synced' ? 0 : 1,
    }
  }

  const excludedSet = new Set(excluded)
  const diffs: RuleDiff[] = []
  for (const rule of Object.keys(lock.rules).toSorted()) {
    if (excludedSet.has(rule)) continue
    const item = sourceByRule.get(rule)
    if (item === undefined) continue

    const localText = localTextFor(opts.target, rule)
    const sourceText = item.content
    const state = driftStateFor(localText, sourceText)
    if (state === 'synced') continue

    const { additions, deletions } = countChanges(localText ?? '', sourceText)
    diffs.push({ rule, state, additions, deletions })
  }

  return { ok: true, diffs, exitCode: diffs.length > 0 ? 1 : 0 }
}
