import matter from 'gray-matter'
import { downloadTemplate } from 'giget'
import { connect } from 'node:net'
import { join } from 'node:path'
import {
  allowedToolsFor,
  buildPromptFor,
  recordBuild,
  runClaude,
  verifyBuild,
  writebackPromptFor,
} from './claude'
import { readTextIfExists, runCommand, sha256, spawnDetached, writeFileAtomic } from './io'
import type { CommandRunner } from './io'
import { buildCatalog, catalogStaleness, renderCatalog } from './catalog'
import { globalsViolations } from './globals'
import { KINDS } from './kinds'
import type { FetchJson } from './kinds'
import { discoverAssets } from './meta'
import type { MetaAsset } from './meta'
import { loadOverview } from './overview'
import { loadLock, loadSkills, RegistryError, saveLock } from './registry'
import type { SkillEntry } from './registry'
import { createRunLog } from './run-log'
import type { RunLog } from './run-log'
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
import { loadProfiles, loadTagVocabulary, validateComposition } from './composition'
import type { Profiles, TagVocabulary } from './composition'

export interface ActionContext {
  repoRoot: string
  run: CommandRunner
  now: () => string
  claude: typeof runClaude
  download: DownloadFn
  fetchJson: FetchJson
  fetchStatus: (url: string) => Promise<{ status: number; location?: string }>
  spawnDetached: typeof spawnDetached
}

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

// Bun's fetch honors http_proxy/all_proxy for every request, including loopback ones.
// Bun also snapshots those env vars once at startup, so neither a per-request `proxy`
// fetch option nor mutating process.env at runtime changes that later. A raw socket
// via node:net sidesteps fetch entirely and never consults the proxy env.
export function isLoopback(url: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(url).hostname)
  } catch {
    return false
  }
}

function fetchJsonLoopback(url: string): Promise<unknown> {
  const { hostname, port, pathname, search } = new URL(url)
  const path = `${pathname}${search}`
  const portNum = port === '' ? 80 : Number(port)
  return new Promise((resolve, reject) => {
    const socket = connect({ host: hostname, port: portNum }, () => {
      socket.write(`GET ${path} HTTP/1.1\r\nHost: ${hostname}:${portNum}\r\nConnection: close\r\n\r\n`)
    })
    let raw = ''
    socket.on('data', (chunk: Buffer) => {
      raw += chunk.toString('utf8')
    })
    socket.on('error', reject)
    socket.on('end', () => {
      const separator = raw.indexOf('\r\n\r\n')
      if (separator === -1) {
        reject(new Error(`fetch ${url} failed: malformed HTTP response`))
        return
      }
      const statusLine = raw.slice(0, separator).split('\r\n')[0] ?? ''
      const status = Number(statusLine.split(' ')[1])
      const body = raw.slice(separator + 4)
      if (status < 200 || status >= 300) {
        reject(new Error(`fetch ${url} failed: ${status}`))
        return
      }
      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(new Error(`fetch ${url} failed: invalid JSON body: ${String(error)}`))
      }
    })
  })
}

export function defaultContext(repoRoot: string): ActionContext {
  return {
    repoRoot,
    run: runCommand,
    now: () => new Date().toISOString(),
    claude: runClaude,
    download: downloadTemplate,
    fetchJson: async (url) => {
      if (isLoopback(url)) return fetchJsonLoopback(url)
      const res = await fetch(url)
      if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`)
      return res.json()
    },
    fetchStatus: async (url) => {
      const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000) })
      const location = res.headers.get('location')
      return location === null ? { status: res.status } : { status: res.status, location }
    },
    spawnDetached,
  }
}

export interface ActionHooks {
  onText?: (t: string) => void
  onStep?: (step: string, data?: Record<string, unknown>) => void
}

export interface ArgSpec {
  name: string
  kind: 'positional' | 'flag' | 'option'
  required?: boolean
  variadic?: boolean
  description: string
}

export interface ActionParams {
  positionals: string[]
  flags: Record<string, boolean>
  options?: Record<string, string>
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
  tags: string[]
  requires: string[]
  metaPath: string
  artifactPath: string
}

export interface StatusData {
  rows: StatusRowData[]
  violations: string[]
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
  args: [
    { name: 'name', kind: 'positional', description: 'asset name (optional)' },
    { name: 'tag', kind: 'option', description: 'filter rules by tag' },
  ],
  async execute(ctx, params) {
    let vocab: TagVocabulary
    let profiles: Profiles
    try {
      vocab = loadTagVocabulary(ctx.repoRoot)
      profiles = loadProfiles(ctx.repoRoot)
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error))
    }
    const rows = loadOverview(ctx.repoRoot)
    const name = params.positionals[0]
    let selected = name ? rows.filter((r) => r.asset.name === name) : rows
    if (name && selected.length === 0) return fail(`unknown asset: ${name}`)
    const tag = params.options?.tag
    if (tag !== undefined) selected = selected.filter((r) => r.asset.tags.includes(tag))
    const dataRows: StatusRowData[] = selected.map((r) => ({
      name: r.asset.name,
      kind: r.asset.kind,
      status: r.status,
      scope: r.asset.scope,
      tags: r.asset.tags,
      requires: r.asset.requires,
      metaPath: r.asset.metaPath,
      artifactPath: r.asset.artifactPath,
    }))
    const violations = validateComposition(
      rows.map((r) => r.asset),
      vocab,
      profiles,
    )
    const staleness = catalogStaleness(ctx.repoRoot)
    if (staleness !== null) violations.push(staleness)
    violations.push(...globalsViolations(ctx.repoRoot))
    const pending = dataRows.some((d) => PENDING_STATUSES.has(d.status))
    const data: StatusData = { rows: dataRows, violations }
    return { ok: true, data, exitCode: pending || violations.length > 0 ? 1 : 0 }
  },
}

const catalogAction: ActionDef = {
  id: 'catalog',
  summary: 'Regenerate catalog.json from meta frontmatter, tags and profiles',
  kind: 'mutation',
  args: [],
  async execute(ctx) {
    try {
      const catalog = buildCatalog(ctx.repoRoot, ctx.now)
      writeFileAtomic(join(ctx.repoRoot, 'catalog.json'), renderCatalog(catalog))
      return { ok: true, message: `catalog.json: ${Object.keys(catalog.rules).length} rules` }
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error))
    }
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

async function statusSnapshot(ctx: ActionContext): Promise<Set<string> | string> {
  const res = await ctx.run('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: ctx.repoRoot })
  if (res.code !== 0) return `changeset guard: git status failed: ${res.stderr}`
  return new Set(res.stdout.split('\n').filter((line) => line !== ''))
}

function unquotePath(raw: string): string {
  return raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw
}

async function buildOne(ctx: ActionContext, asset: MetaAsset, hooks?: ActionHooks): Promise<string | null> {
  const pre = KINDS[asset.kind].preBuildCheck
  if (pre) {
    let preErr: string | null
    try {
      preErr = await pre(ctx.fetchJson, asset)
    } catch (error) {
      preErr = `pre-build check failed: ${String(error)}`
    }
    if (preErr) return preErr
    hooks?.onStep?.('preBuildCheck', { ok: true })
  }
  const before = await statusSnapshot(ctx)
  if (typeof before === 'string') return before
  const res = await ctx.claude({
    repoRoot: ctx.repoRoot,
    prompt: buildPromptFor(asset),
    allowedTools: allowedToolsFor(asset, 'build'),
    onText: hooks?.onText,
  })
  if (res.timedOut) return 'claude timed out'
  if (res.code !== 0) return `claude exited ${res.code}: ${res.stderr.slice(-500)}`
  const after = await statusSnapshot(ctx)
  if (typeof after === 'string') return after
  const prefix = KINDS[asset.kind].writableGlob(asset.name).replace(/\*.*$/u, '')
  // Limitation: a claude edit to a file that was already dirty before the build produces
  // no new porcelain line and goes undetected; this guard is a second line of defense
  // outside the allowedTools sandbox, not the sole safeguard.
  const escaped = [...after]
    .filter((line) => !before.has(line))
    .map((line) => unquotePath(line.slice(3)))
    .filter((path) => !path.startsWith(prefix))
  if (escaped.length > 0) {
    return `changeset guard: files changed outside the build sandbox: ${escaped.join(', ')}`
  }
  hooks?.onStep?.('changeset-guard', { ok: true })
  const err = verifyBuild(ctx.repoRoot, asset)
  if (err === null) {
    hooks?.onStep?.('verify', { ok: true })
  } else {
    hooks?.onStep?.('verify', { ok: false, error: err })
    return err
  }
  recordBuild(ctx.repoRoot, asset, ctx.now())
  hooks?.onStep?.('record', { key: lockKey(asset) })
  const catalog = buildCatalog(ctx.repoRoot, ctx.now)
  writeFileAtomic(join(ctx.repoRoot, 'catalog.json'), renderCatalog(catalog))
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
    const metaAbs = join(ctx.repoRoot, asset.metaPath)
    const before = readTextIfExists(metaAbs) ?? ''
    const res = await ctx.claude({
      repoRoot: ctx.repoRoot,
      prompt: writebackPromptFor(asset),
      allowedTools: allowedToolsFor(asset, 'writeback'),
      onText: hooks?.onText,
    })
    if (res.timedOut) return fail('claude timed out')
    if (res.code !== 0) return fail(`claude exited ${res.code}: ${res.stderr.slice(-500)}`)
    const after = readTextIfExists(metaAbs) ?? ''
    if (sha256(after) === sha256(before)) {
      return fail(`${name}: writeback made no change to the meta instruction`)
    }
    let fmBefore: Record<string, unknown>
    let fmAfter: Record<string, unknown>
    try {
      fmBefore = matter(before).data as Record<string, unknown>
      fmAfter = matter(after).data as Record<string, unknown>
    } catch (error) {
      return fail(`${name}: writeback produced unparseable frontmatter: ${String(error)}`)
    }
    for (const key of new Set([...Object.keys(fmBefore), ...Object.keys(fmAfter)])) {
      if (asset.kind === 'rule' && key === 'scope') continue
      if (JSON.stringify(fmBefore[key]) !== JSON.stringify(fmAfter[key])) {
        return fail(`${name}: writeback modified frontmatter field '${key}'`)
      }
    }
    return { ok: true, message: `wrote back ${name}; meta changed, asset is now stale` }
  },
}

const PREVIEW_URL = 'http://localhost:4412'

const previewAction: ActionDef = {
  id: 'preview',
  summary: 'Open the web preview (meta vs artifact side by side), starting the server if needed',
  kind: 'mutation',
  args: [{ name: 'name', kind: 'positional', description: 'asset name (optional)' }],
  async execute(ctx, params, hooks) {
    const name = params.positionals[0]
    if (name !== undefined && findAsset(ctx.repoRoot, name) === null) {
      return fail(`unknown asset: ${name}`)
    }
    const probe = async (): Promise<boolean> => {
      try {
        await ctx.fetchJson(`${PREVIEW_URL}/api/assets`)
        return true
      } catch {
        return false
      }
    }
    if (!(await probe())) {
      hooks?.onText?.('starting preview server...')
      ctx.spawnDetached('bun', ['run', 'dev'], {
        cwd: join(ctx.repoRoot, 'packages/preview'),
        logPath: join(ctx.repoRoot, '.imeta', 'preview-server.log'),
      })
      let ready = false
      for (let i = 0; i < 20 && !ready; i++) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 250)
        })
        ready = await probe()
      }
      if (!ready) {
        return fail('preview server failed to start (log: .imeta/preview-server.log)')
      }
    }
    const url = `${PREVIEW_URL}/${name === undefined ? '' : `#${encodeURIComponent(name)}`}`
    const res = await ctx.run('open', [url])
    if (res.code !== 0) return fail(`open failed: ${res.stderr}`)
    return { ok: true, message: `preview at ${url}` }
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

export type LinkVerdict = 'ok' | 'broken' | 'moved' | 'unreachable'

export interface LinkRow {
  asset: string
  refUrl: string
  verdict: LinkVerdict
  location?: string
}

export function classifyLinkStatus(status: number): 'ok' | 'broken' | 'moved' {
  if (status === 404 || status === 410) return 'broken'
  if (status === 301 || status === 308) return 'moved'
  return 'ok'
}

const linksAction: ActionDef = {
  id: 'links',
  summary: 'Check refUrl health for all assets (network)',
  kind: 'query',
  args: [],
  async execute(ctx) {
    const targets: { asset: string; refUrl: string }[] = []
    let skills: SkillEntry[]
    try {
      skills = loadSkills(ctx.repoRoot)
    } catch (error) {
      if (error instanceof RegistryError && error.message === 'skills.json: file not found') skills = []
      else throw error
    }
    for (const entry of skills) {
      if (entry.refUrl !== undefined) targets.push({ asset: `skill:${entry.name}`, refUrl: entry.refUrl })
    }
    for (const asset of discoverAssets(ctx.repoRoot)) {
      if (asset.refUrl !== '') targets.push({ asset: `${asset.kind}:${asset.name}`, refUrl: asset.refUrl })
    }
    const rows: LinkRow[] = []
    for (const t of targets) {
      try {
        const res = await ctx.fetchStatus(t.refUrl)
        const verdict = classifyLinkStatus(res.status)
        rows.push(verdict === 'moved' && res.location !== undefined
          ? { ...t, verdict, location: res.location }
          : { ...t, verdict })
      } catch {
        rows.push({ ...t, verdict: 'unreachable' })
      }
    }
    const needsUpdate = rows.filter((r) => r.verdict === 'broken' || r.verdict === 'moved')
    const lines = rows.map((r) => {
      if (r.verdict === 'broken') return `${r.asset}: 参考来源需更新 (404/410) ${r.refUrl}`
      if (r.verdict === 'moved') return `${r.asset}: 参考来源需更新 (moved) ${r.refUrl} -> ${r.location ?? '?'}`
      if (r.verdict === 'unreachable') return `${r.asset}: unreachable (network), skipped ${r.refUrl}`
      return `${r.asset}: ok`
    })
    return {
      ok: true,
      message: lines.length > 0 ? lines.join('\n') : 'no refUrl recorded yet',
      data: { rows },
      exitCode: needsUpdate.length > 0 ? 1 : 0,
    }
  },
}

export const ACTIONS: ActionDef[] = [
  statusAction,
  adoptAction,
  buildAction,
  writebackAction,
  previewAction,
  catalogAction,
  skillsStatusAction,
  skillsFixAction,
  skillsUpdateAction,
  linksAction,
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
  let runLog: RunLog
  try {
    runLog = createRunLog(ctx.repoRoot, id, params, ctx.now())
  } catch (error) {
    console.error(`run-log unavailable: ${String(error)}`)
    runLog = { path: '', event: () => {}, close: () => {} }
  }
  runLog.event('start', { params })
  const wrappedHooks: ActionHooks = {
    ...hooks,
    onText: (t) => {
      runLog.event('text', { text: t })
      hooks?.onText?.(t)
    },
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
        onEvent: (raw) => {
          runLog.event('claude:event', { event: raw })
          opts.onEvent?.(raw)
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
    return { ...result, ...(runLog.path === '' ? {} : { logPath: runLog.path }) }
  } catch (error) {
    runLog.event('error', { error: String(error) })
    throw error
  } finally {
    runLog.close()
  }
}
