import { downloadTemplate } from 'giget'
import {
  allowedToolsFor,
  buildPromptFor,
  recordBuild,
  runClaude,
  verifyBuild,
  writebackPromptFor,
} from './claude'
import { runCommand } from './io'
import type { CommandRunner } from './io'
import { discoverAssets } from './meta'
import type { MetaAsset } from './meta'
import { loadOverview } from './overview'
import { loadLock, loadSkills, saveLock } from './registry'
import { createRunLog } from './run-log'
import {
  checkMirrors,
  checkSkillsLedger,
  fixSkillsLedger,
  listInstalledSkills,
  officialRecommendations,
  updateMirror,
} from './skills-sync'
import type { DownloadFn, LedgerIssue, MirrorStatus, Recommendation } from './skills-sync'
import { adoptEntry, computeStatus, gatherFacts, lockKey } from './status'
import type { ReconcileStatus } from './status'

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
  onStep?: (step: string, data?: Record<string, unknown>) => void
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

function findAsset(repoRoot: string, name: string): MetaAsset | null {
  return discoverAssets(repoRoot).find((a) => a.name === name) ?? null
}

// spec Decision 7: dirty/stale/unbuilt/untracked 或下游 drift/missing 计入待收敛；stub 不计
const PENDING_STATUSES: ReadonlySet<string> = new Set(
  ['dirty', 'stale', 'unbuilt', 'untracked'] satisfies ReconcileStatus[],
)

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
    }))
    const pending = data.some((d) => PENDING_STATUSES.has(d.status))
    return { ok: true, data, exitCode: pending ? 1 : 0 }
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

const adoptAction: ActionDef = {
  id: 'adopt',
  summary: 'Record current meta/artifact hashes as the lock baseline for an untracked asset',
  kind: 'mutation',
  args: [{ name: 'name', kind: 'positional', required: true, description: 'asset name' }],
  async execute(ctx, params) {
    const name = params.positionals[0]
    if (!name) return fail('asset name required')
    const asset = findAsset(ctx.repoRoot, name)
    if (!asset) return fail(`unknown asset: ${name}`)
    const lock = loadLock(ctx.repoRoot)
    const facts = gatherFacts(ctx.repoRoot, asset, lock)
    const status = computeStatus(facts)
    if (status !== 'untracked') return fail(`${name} is not untracked (status: ${status})`)
    if (facts.artifactHash === null) return fail(`artifact missing: ${asset.artifactPath}`)
    saveLock(ctx.repoRoot, {
      ...lock,
      [lockKey(asset)]: adoptEntry(facts.metaHash, facts.artifactHash, ctx.now()),
    })
    return { ok: true, message: `adopted ${name}` }
  },
}

async function buildOne(ctx: ActionContext, asset: MetaAsset, hooks?: ActionHooks): Promise<string | null> {
  const res = await ctx.claude({
    repoRoot: ctx.repoRoot,
    prompt: buildPromptFor(asset),
    allowedTools: allowedToolsFor(asset, 'build'),
    onText: hooks?.onText,
  })
  if (res.timedOut) return 'claude timed out'
  if (res.code !== 0) return `claude exited ${res.code}: ${res.stderr.slice(-500)}`
  const err = verifyBuild(ctx.repoRoot, asset)
  if (err === null) {
    hooks?.onStep?.('verify', { ok: true })
  } else {
    hooks?.onStep?.('verify', { ok: false, error: err })
    return err
  }
  recordBuild(ctx.repoRoot, asset, ctx.now())
  hooks?.onStep?.('record', { key: lockKey(asset) })
  return null
}

const buildAction: ActionDef = {
  id: 'build',
  summary: 'Build artifacts from meta instructions via claude headless',
  kind: 'mutation',
  args: [
    { name: 'name', kind: 'positional', variadic: true, description: 'asset names' },
    { name: 'stale', kind: 'flag', description: 'build all stale assets' },
  ],
  async execute(ctx, params, hooks) {
    let assets: MetaAsset[]
    if (params.flags.stale) {
      if (params.positionals.length > 0) return fail('--stale takes no asset names')
      assets = loadOverview(ctx.repoRoot)
        .filter((r) => r.status === 'stale')
        .map((r) => r.asset)
      if (assets.length === 0) return { ok: true, message: 'no stale assets' }
    } else {
      if (params.positionals.length === 0) return fail('asset name required (or --stale)')
      const resolved: MetaAsset[] = []
      for (const name of params.positionals) {
        const asset = findAsset(ctx.repoRoot, name)
        if (!asset) return fail(`unknown asset: ${name}`)
        if (asset.status === 'stub') return fail(`${name} is stub: complete the meta instruction first`)
        resolved.push(asset)
      }
      assets = resolved
    }
    const built: string[] = []
    for (const asset of assets) {
      hooks?.onText?.(`--- ${asset.name} ---`)
      const err = await buildOne(ctx, asset, hooks)
      if (err) {
        const done = built.length > 0 ? ` (already built: ${built.join(', ')})` : ''
        return fail(`${asset.name}: ${err}${done}`)
      }
      built.push(asset.name)
    }
    return { ok: true, message: `built ${built.join(', ')}` }
  },
}

const writebackAction: ActionDef = {
  id: 'writeback',
  summary: 'Write valuable direct artifact edits back into the meta instruction via claude headless',
  kind: 'mutation',
  args: [{ name: 'name', kind: 'positional', required: true, description: 'asset name' }],
  async execute(ctx, params, hooks) {
    const name = params.positionals[0]
    if (!name) return fail('asset name required')
    const asset = findAsset(ctx.repoRoot, name)
    if (!asset) return fail(`unknown asset: ${name}`)
    const status = computeStatus(gatherFacts(ctx.repoRoot, asset, loadLock(ctx.repoRoot)))
    if (status !== 'dirty') return fail(`${name} is not dirty (status: ${status})`)
    const res = await ctx.claude({
      repoRoot: ctx.repoRoot,
      prompt: writebackPromptFor(asset),
      allowedTools: allowedToolsFor(asset, 'writeback'),
      onText: hooks?.onText,
    })
    if (res.timedOut) return fail('claude timed out')
    if (res.code !== 0) return fail(`claude exited ${res.code}: ${res.stderr.slice(-500)}`)
    return { ok: true, message: `wrote back ${name}; meta changed, asset is now stale` }
  },
}

const skillsFixAction: ActionDef = {
  id: 'skills:fix',
  summary: 'Add unledgered skill directories to skills.json as custom entries',
  kind: 'mutation',
  args: [],
  async execute(ctx) {
    const { added, issues } = fixSkillsLedger(ctx.repoRoot)
    const parts = [added.length > 0 ? `added: ${added.join(', ')}` : 'nothing to fix']
    for (const issue of issues) parts.push(`[${issue.kind}] ${issue.dir}: ${issue.detail}`)
    return { ok: issues.length === 0, message: parts.join('\n'), exitCode: issues.length > 0 ? 1 : 0 }
  },
}

const skillsUpdateAction: ActionDef = {
  id: 'skills:update',
  summary: 'Update outdated mirror skills from upstream and rewrite the ledger',
  kind: 'mutation',
  args: [],
  async execute(ctx, _params, hooks) {
    const mirrors = await checkMirrors(loadSkills(ctx.repoRoot), ctx.run)
    const outdated = mirrors.filter((m) => m.outdated)
    if (outdated.length === 0) return { ok: true, message: 'all mirrors up-to-date' }
    const updated: string[] = []
    for (const m of outdated) {
      hooks?.onText?.(`updating ${m.name} ${m.localCommit.slice(0, 7)} -> ${m.remoteCommit.slice(0, 7)}`)
      try {
        await updateMirror(ctx.repoRoot, m, ctx.now().slice(0, 10), ctx.download)
      } catch (error) {
        const done = updated.length > 0 ? ` (already updated: ${updated.join(', ')})` : ''
        return fail(`${m.name}: ${String(error)}${done}`)
      }
      updated.push(m.name)
    }
    return { ok: true, message: `updated: ${updated.join(', ')}` }
  },
}

export const ACTIONS: ActionDef[] = [
  statusAction,
  adoptAction,
  buildAction,
  writebackAction,
  skillsStatusAction,
  skillsFixAction,
  skillsUpdateAction,
]

export function getAction(id: string): ActionDef {
  const action = ACTIONS.find((a) => a.id === id)
  if (!action) throw new Error(`unknown action: ${id}`)
  return action
}

export interface RunActionResult extends ActionResult {
  logPath?: string
}

export async function runAction(
  ctx: ActionContext,
  id: string,
  params: ActionParams,
  hooks?: ActionHooks,
): Promise<RunActionResult> {
  const action = getAction(id)
  if (action.kind === 'query') return action.execute(ctx, params, hooks)
  const runLog = createRunLog(ctx.repoRoot, id, params, ctx.now())
  runLog.event('start', { params })
  const wrappedHooks: ActionHooks = {
    onStep: (step, data) => {
      runLog.event(step, data)
      hooks?.onStep?.(step, data)
    },
  }
  const claude: ActionContext['claude'] = (opts) => {
    runLog.event('claude:spawn', { prompt: opts.prompt, allowedTools: opts.allowedTools })
    return ctx
      .claude({
        ...opts,
        onEvent: (raw) => runLog.event('claude:event', { event: raw }),
        onText: (t) => {
          runLog.event('text', { text: t })
          opts.onText?.(t)
        },
      })
      .then((res) => {
        runLog.event('claude:exit', {
          code: res.code,
          timedOut: res.timedOut,
          stderr: res.stderr.slice(-2000),
        })
        return res
      })
  }
  try {
    const result = await action.execute({ ...ctx, claude }, params, wrappedHooks)
    runLog.event('result', { ok: result.ok, message: result.message, exitCode: result.exitCode })
    return { ...result, logPath: runLog.path }
  } catch (error) {
    runLog.event('error', { error: String(error) })
    throw error
  } finally {
    runLog.close()
  }
}
