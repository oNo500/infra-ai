import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { loadGlobals } from './contract'
import { readTextIfExists } from './io'
import { assembleRules } from './assemble'
import type { IuseContext } from './init'
import { loadDownstreamLock, ruleTargetRelPath } from './manifest'
import { resolveSource } from './source'

export type GlobalState = 'synced' | 'differs' | 'missing' | 'unmanaged'

export interface GlobalRow {
  rule: string
  state: GlobalState
  suggestion?: string
}

export interface GlobalStatusResult {
  ok: boolean
  message?: string
  rows: GlobalRow[]
  duplicates: string[]
  exitCode: number
}

function globalRulePath(home: string, rule: string): string {
  return join(home, ruleTargetRelPath(rule))
}

export async function globalStatusReport(
  ctx: IuseContext,
  opts: { source?: string; projectTarget?: string },
): Promise<GlobalStatusResult> {
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
    return { ok: false, message: error instanceof Error ? error.message : String(error), rows: [], duplicates: [], exitCode: 1 }
  }

  const globals = loadGlobals(source.root)
  if (globals === null) {
    return {
      ok: false,
      message: `${source.root}: globals.json missing -- declare the global-scope rule set there first (e.g. { "rules": ["markdown"] })`,
      rows: [],
      duplicates: [],
      exitCode: 1,
    }
  }

  let items: ReturnType<typeof assembleRules>['items']
  let missing: ReturnType<typeof assembleRules>['missing']
  let violations: ReturnType<typeof assembleRules>['violations']
  try {
    ;({ items, missing, violations } = assembleRules(source.root, globals.rules))
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error), rows: [], duplicates: [], exitCode: 1 }
  }
  if (missing.length > 0) {
    return {
      ok: false,
      message: `globals.json declares unknown rules: ${missing.toSorted().join(', ')} (fix globals.json at the source, see 'imeta status')`,
      rows: [],
      duplicates: [],
      exitCode: 1,
    }
  }
  if (violations.length > 0) {
    return {
      ok: false,
      message: `assembly violations:\n${violations.map((v) => `  - ${v}`).join('\n')}`,
      rows: [],
      duplicates: [],
      exitCode: 1,
    }
  }
  const sourceByRule = new Map(items.map((i) => [i.rule, i]))

  const rows: GlobalRow[] = []
  for (const rule of [...globals.rules].toSorted()) {
    const item = sourceByRule.get(rule)
    const localText = readTextIfExists(globalRulePath(ctx.home, rule))
    if (localText === null) {
      rows.push({
        rule,
        state: 'missing',
        suggestion: item === undefined ? undefined : `iuse cat ${rule} > ${globalRulePath(ctx.home, rule)}`,
      })
      continue
    }
    if (item !== undefined && localText === item.content) {
      rows.push({ rule, state: 'synced' })
      continue
    }
    rows.push({
      rule,
      state: 'differs',
      suggestion:
        item === undefined
          ? `iuse diff --global --rule ${rule} 查看差异`
          : `iuse diff --global --rule ${rule} 查看差异; 采纳源版本: iuse cat ${rule} > ${globalRulePath(ctx.home, rule)}`,
    })
  }

  const declared = new Set(globals.rules)
  const globalRulesDir = join(ctx.home, '.claude/rules')
  const present: string[] = (() => {
    try {
      return readdirSync(globalRulesDir).filter((f) => f.endsWith('.md'))
    } catch {
      return []
    }
  })()
  for (const file of present.toSorted()) {
    const name = file.replace(/\.md$/u, '')
    if (!declared.has(name)) rows.push({ rule: name, state: 'unmanaged' })
  }

  const duplicates: string[] = []
  if (opts.projectTarget !== undefined) {
    const lock = loadDownstreamLock(opts.projectTarget)
    if (lock !== null) {
      for (const rule of Object.keys(lock.rules).toSorted()) {
        if (readTextIfExists(globalRulePath(ctx.home, rule)) !== null) duplicates.push(rule)
      }
    }
  }

  const exitCode = rows.some((r) => r.state === 'differs' || r.state === 'missing') ? 1 : 0
  return { ok: true, rows, duplicates, exitCode }
}
