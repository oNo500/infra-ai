import { downloadTemplate } from 'giget'
import {
  allowedToolsFor,
  buildPromptFor,
  recordBuild,
  runClaude,
  verifyBuild,
  writebackPromptFor,
} from './claude'
import { downstreamStates, distribute, subscribers } from './dist'
import { runCommand } from './io'
import type { CommandRunner } from './io'
import { discoverAssets } from './meta'
import type { MetaAsset } from './meta'
import { loadOverview } from './overview'
import { loadLock, loadSkills, loadTargets, saveLock, saveTargets } from './registry'
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
  if (err) return err
  recordBuild(ctx.repoRoot, asset, ctx.now())
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

const distAction: ActionDef = {
  id: 'dist',
  summary: 'Copy rule artifacts to subscribed downstream projects',
  kind: 'mutation',
  args: [
    { name: 'name', kind: 'positional', variadic: true, description: 'rule asset names' },
    { name: 'all', kind: 'flag', description: 'distribute all rules with drift or missing downstream copies' },
  ],
  async execute(ctx, params, hooks) {
    const targets = loadTargets(ctx.repoRoot)
    const copied: string[] = []
    if (params.flags.all) {
      const pending = loadOverview(ctx.repoRoot).filter(
        (r) => r.asset.kind === 'rule' && r.downstream.drift + r.downstream.missing > 0,
      )
      for (const r of pending) {
        for (const { target, state } of downstreamStates(ctx.repoRoot, r.asset, targets)) {
          if (state === 'synced') continue
          distribute(ctx.repoRoot, r.asset, target)
          hooks?.onText?.(`${r.asset.name} -> ${target.path}`)
          copied.push(target.path)
        }
      }
      return {
        ok: true,
        message: copied.length > 0 ? `distributed ${copied.length} copies` : 'nothing to distribute',
      }
    }
    if (params.positionals.length === 0) return fail('asset name required (or --all)')
    for (const name of params.positionals) {
      const asset = findAsset(ctx.repoRoot, name)
      if (!asset) return fail(`unknown asset: ${name}`)
      if (asset.kind !== 'rule') return fail(`${name} is not a rule (only rules are distributable)`)
      const subs = subscribers(targets, name)
      if (subs.length === 0) return fail(`${name} has no subscribers (register via: meta targets subscribe <path> ${name})`)
      for (const target of subs) {
        distribute(ctx.repoRoot, asset, target)
        hooks?.onText?.(`${name} -> ${target.path}`)
        copied.push(target.path)
      }
    }
    return { ok: true, message: `distributed ${copied.length} copies` }
  },
}

const targetsAddAction: ActionDef = {
  id: 'targets:add',
  summary: 'Register a downstream project path',
  kind: 'mutation',
  args: [{ name: 'path', kind: 'positional', required: true, description: 'absolute path of downstream project' }],
  async execute(ctx, params) {
    const path = params.positionals[0]
    if (!path) return fail('path required')
    if (!path.startsWith('/')) return fail('path must be absolute')
    const targets = loadTargets(ctx.repoRoot)
    if (targets.some((t) => t.path === path)) return fail(`target already registered: ${path}`)
    saveTargets(ctx.repoRoot, [...targets, { path, subscriptions: [] }])
    return { ok: true, message: `added target ${path}` }
  },
}

const targetsRemoveAction: ActionDef = {
  id: 'targets:remove',
  summary: 'Unregister a downstream project path',
  kind: 'mutation',
  args: [{ name: 'path', kind: 'positional', required: true, description: 'registered target path' }],
  async execute(ctx, params) {
    const path = params.positionals[0]
    if (!path) return fail('path required')
    const targets = loadTargets(ctx.repoRoot)
    if (!targets.some((t) => t.path === path)) return fail(`unknown target: ${path}`)
    saveTargets(ctx.repoRoot, targets.filter((t) => t.path !== path))
    return { ok: true, message: `removed target ${path}` }
  },
}

function isSubscribableRule(repoRoot: string, name: string): string | null {
  const row = loadOverview(repoRoot).find((r) => r.asset.name === name)
  if (!row) return `unknown asset: ${name}`
  if (row.asset.kind !== 'rule') return `${name} is not a rule`
  if (row.status === 'stub' || row.status === 'unbuilt') return `${name} has no built artifact (status: ${row.status})`
  return null
}

const targetsSubscribeAction: ActionDef = {
  id: 'targets:subscribe',
  summary: 'Subscribe a target to a built rule artifact',
  kind: 'mutation',
  args: [
    { name: 'path', kind: 'positional', required: true, description: 'registered target path' },
    { name: 'rule', kind: 'positional', required: true, description: 'rule asset name' },
  ],
  async execute(ctx, params) {
    const [path, rule] = params.positionals
    if (!path || !rule) return fail('path and rule required')
    const targets = loadTargets(ctx.repoRoot)
    const target = targets.find((t) => t.path === path)
    if (!target) return fail(`unknown target: ${path}`)
    const err = isSubscribableRule(ctx.repoRoot, rule)
    if (err) return fail(err)
    if (target.subscriptions.includes(rule)) return fail(`${path} already subscribes to ${rule}`)
    saveTargets(
      ctx.repoRoot,
      targets.map((t) => (t.path === path ? Object.assign({}, t, { subscriptions: [...t.subscriptions, rule] }) : t)),
    )
    return { ok: true, message: `${path} subscribed to ${rule}` }
  },
}

const targetsUnsubscribeAction: ActionDef = {
  id: 'targets:unsubscribe',
  summary: 'Remove a rule subscription from a target',
  kind: 'mutation',
  args: [
    { name: 'path', kind: 'positional', required: true, description: 'registered target path' },
    { name: 'rule', kind: 'positional', required: true, description: 'rule asset name' },
  ],
  async execute(ctx, params) {
    const [path, rule] = params.positionals
    if (!path || !rule) return fail('path and rule required')
    const targets = loadTargets(ctx.repoRoot)
    const target = targets.find((t) => t.path === path)
    if (!target) return fail(`unknown target: ${path}`)
    if (!target.subscriptions.includes(rule)) return fail(`${path} does not subscribe to ${rule}`)
    saveTargets(
      ctx.repoRoot,
      targets.map((t) =>
        t.path === path ? Object.assign({}, t, { subscriptions: t.subscriptions.filter((s) => s !== rule) }) : t,
      ),
    )
    return { ok: true, message: `${path} unsubscribed from ${rule}` }
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
  distAction,
  targetsListAction,
  targetsAddAction,
  targetsRemoveAction,
  targetsSubscribeAction,
  targetsUnsubscribeAction,
  skillsStatusAction,
  skillsFixAction,
  skillsUpdateAction,
]

export function getAction(id: string): ActionDef {
  const action = ACTIONS.find((a) => a.id === id)
  if (!action) throw new Error(`unknown action: ${id}`)
  return action
}
