import { downloadTemplate } from 'giget'
import { runClaude } from './claude'
import { runCommand } from './io'
import type { CommandRunner } from './io'
import { loadOverview } from './overview'
import { loadSkills, loadTargets } from './registry'
import {
  checkMirrors,
  checkSkillsLedger,
  listInstalledSkills,
  officialRecommendations,
} from './skills-sync'
import type { DownloadFn, LedgerIssue, MirrorStatus, Recommendation } from './skills-sync'

export interface ActionContext {
  repoRoot: string
  run: CommandRunner
  now: () => string
  claude: typeof runClaude
  download: DownloadFn
}

export function defaultContext(repoRoot: string): ActionContext {
  return {
    repoRoot,
    run: runCommand,
    now: () => new Date().toISOString(),
    claude: runClaude,
    download: downloadTemplate,
  }
}

export interface ActionHooks {
  onText?: (t: string) => void
}

export interface ArgSpec {
  name: string
  kind: 'positional' | 'flag'
  required?: boolean
  variadic?: boolean
  description: string
}

export interface ActionParams {
  positionals: string[]
  flags: Record<string, boolean>
}

export interface ActionResult {
  ok: boolean
  message?: string
  data?: unknown
  exitCode?: number
}

export interface ActionDef {
  id: string
  summary: string
  kind: 'query' | 'mutation'
  args: ArgSpec[]
  execute(ctx: ActionContext, params: ActionParams, hooks?: ActionHooks): Promise<ActionResult>
}

export interface StatusRowData {
  name: string
  kind: string
  status: string
  scope: string | null
  metaPath: string
  artifactPath: string
  downstream: { synced: number; drift: number; missing: number }
  targets: { path: string; state: string }[]
}

export interface SkillsStatusData {
  issues: LedgerIssue[]
  mirrors: MirrorStatus[]
  installed: string[]
  recommendations: Recommendation[]
}

function fail(message: string): ActionResult {
  return { ok: false, message, exitCode: 1 }
}

// spec Decision 7: dirty/stale/unbuilt 或下游 drift/missing 计入待收敛；untracked 与 stub 不计
const PENDING_STATUSES = new Set(['dirty', 'stale', 'unbuilt'])

const statusAction: ActionDef = {
  id: 'status',
  summary: 'Show reconcile status for all assets or one asset',
  kind: 'query',
  args: [{ name: 'name', kind: 'positional', description: 'asset name (optional)' }],
  async execute(ctx, params) {
    const rows = loadOverview(ctx.repoRoot)
    const name = params.positionals[0]
    const selected = name ? rows.filter((r) => r.asset.name === name) : rows
    if (name && selected.length === 0) return fail(`unknown asset: ${name}`)
    const data: StatusRowData[] = selected.map((r) => ({
      name: r.asset.name,
      kind: r.asset.kind,
      status: r.status,
      scope: r.asset.scope,
      metaPath: r.asset.metaPath,
      artifactPath: r.asset.artifactPath,
      downstream: r.downstream,
      targets: r.targets,
    }))
    const pending = data.some(
      (d) => PENDING_STATUSES.has(d.status) || d.downstream.drift + d.downstream.missing > 0,
    )
    return { ok: true, data, exitCode: pending ? 1 : 0 }
  },
}

const targetsListAction: ActionDef = {
  id: 'targets:list',
  summary: 'List distribution targets and their subscriptions',
  kind: 'query',
  args: [],
  async execute(ctx) {
    return { ok: true, data: loadTargets(ctx.repoRoot), exitCode: 0 }
  },
}

const skillsStatusAction: ActionDef = {
  id: 'skills:status',
  summary: 'Show skills ledger issues, mirror freshness, installed and recommended skills',
  kind: 'query',
  args: [],
  async execute(ctx) {
    const skills = loadSkills(ctx.repoRoot)
    const issues = checkSkillsLedger(ctx.repoRoot)
    const [mirrors, installed] = await Promise.all([
      checkMirrors(skills, ctx.run),
      listInstalledSkills(ctx.run),
    ])
    const data: SkillsStatusData = {
      issues,
      mirrors,
      installed,
      recommendations: officialRecommendations(skills),
    }
    const pending = issues.length > 0 || mirrors.some((m) => m.outdated)
    return { ok: true, data, exitCode: pending ? 1 : 0 }
  },
}

export const ACTIONS: ActionDef[] = [statusAction, targetsListAction, skillsStatusAction]

export function getAction(id: string): ActionDef {
  const action = ACTIONS.find((a) => a.id === id)
  if (!action) throw new Error(`unknown action: ${id}`)
  return action
}
