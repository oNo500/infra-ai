import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { runClaude } from './claude'
import { readTextIfExists, writeFileAtomic } from './io'
import type { CommandRunner } from './io'
import { assembleRules, planAssembly } from './assemble'
import { LOCK_PATH, loadDownstreamLock, saveDownstreamLock } from './manifest'
import { resolveSource } from './source'
import { detectSourceRoot } from './source-root'

type DownloadFn = (input: string, opts: { dir: string; forceClean?: boolean }) => Promise<unknown>

export interface IuseContext {
  download: DownloadFn
  run: CommandRunner
  claude: typeof runClaude
  now: () => string
  env: Record<string, string | undefined>
  home: string
  cacheDir: string
}

interface TemplateSpec {
  name: 'architecture' | 'claude-md'
  sourceRelPath: string
  targetRelPath: string
}

const TEMPLATE_SPECS: TemplateSpec[] = [
  { name: 'architecture', sourceRelPath: 'templates/architecture.md', targetRelPath: '.claude/rules/architecture.md' },
  { name: 'claude-md', sourceRelPath: 'templates/claude-md.md', targetRelPath: '.claude/CLAUDE.md' },
]

const PLACEHOLDER_PATTERN = /\[[A-Z][A-Z0-9_]*\]/u

export interface ActionStep {
  op: string
  target: string
  note?: string
}

export function formatSteps(steps: ActionStep[]): string {
  return steps.map((s) => (s.note === undefined ? `${s.op} ${s.target}` : `${s.op} ${s.target} (${s.note})`)).join('\n')
}

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message }
}

// 实例化失败会把 .iuse-staging（含日志）留在目标项目供排错。此时确保目标
// .gitignore 忽略它，以免用户误提交。仅在暂存目录确有残留时才碰 gitignore；
// 幂等：已忽略则不动。成功路径不调用——暂存目录会被清掉，无需留 ignore 行。
function ensureStagingIgnored(target: string): void {
  if (!existsSync(join(target, '.iuse-staging'))) return
  const gitignorePath = join(target, '.gitignore')
  const existing = readTextIfExists(gitignorePath) ?? ''
  if (existing.split('\n').some((line) => line.trim() === '.iuse-staging/')) return
  const prefix = existing === '' || existing.endsWith('\n') ? existing : `${existing}\n`
  writeFileAtomic(gitignorePath, `${prefix}.iuse-staging/\n`)
}

async function instantiateTemplate(
  ctx: IuseContext,
  artifactBase: string,
  target: string,
  spec: TemplateSpec,
  force: boolean,
): Promise<{ ok: boolean; message: string; skipped: boolean }> {
  const targetFile = join(target, spec.targetRelPath)
  // 校验是写入时门禁，不是常驻不变量——跳过的既有产物不重新校验（--force 重建才再次过校验）。
  if (existsSync(targetFile) && !force) {
    return { ok: true, skipped: true, message: `${spec.targetRelPath}: already present, skipped (use --force to re-instantiate)` }
  }

  const contractPath = join(artifactBase, 'templates/template-instantiate.md')
  if (readTextIfExists(contractPath) === null) {
    return {
      ok: false,
      skipped: false,
      message: `${spec.targetRelPath}: contract missing at ${contractPath} -- source has not received the relocated template contract (templates/template-instantiate.md); run imeta publish in the dev repo`,
    }
  }
  const templatePath = join(artifactBase, spec.sourceRelPath)
  // CLAUDE.md 与 .claude/** 是权限系统的敏感文件，headless 下 allowedTools
  // 无法放行直写——claude 只写非敏感的 staging 文件，落位由本进程完成
  const stagingRel = `.iuse-staging/${spec.name}.md`
  const stagingFile = join(target, stagingRel)

  // 留痕 claude 事件流到目标项目内，供失败排错（headless 下 claude 声称完成
  // 却未落盘时，这是唯一能看到它实际输出的地方）。时间戳用 ctx.now() 以便测试可控。
  // logs 目录递归创建，同时建出 .iuse-staging 父目录。
  const logPath = join(target, '.iuse-staging', 'logs', `${spec.name}-${ctx.now().replaceAll(':', '-')}.jsonl`)
  mkdirSync(join(target, '.iuse-staging', 'logs'), { recursive: true })
  const logHint = ` (log: ${logPath})`
  // claude 的 result 事件带最终结论文本。若它跑完 success 却没落盘，这段结论
  // 通常是它「无法实例化」的理由（如目标项目无事实可填），据此区分「明确拒绝」
  // 与「真失败」——前者重试无用，不该建议 --force。
  // 对象持有而非裸 let：闭包内赋值不被 TS control-flow 窄化误判为 never。
  const captured: { resultText: string | null } = { resultText: null }
  const onEvent = (raw: unknown): void => {
    appendFileSync(logPath, `${JSON.stringify(raw)}\n`)
    if (typeof raw === 'object' && raw !== null) {
      const ev = raw as { type?: unknown; result?: unknown }
      if (ev.type === 'result' && typeof ev.result === 'string') captured.resultText = ev.result.trim()
    }
  }

  const prompt = [
    `遵循 ${contractPath} 的实例化规则。`,
    `模板文件：${templatePath}`,
    `目标项目根：${target}`,
    `目标文件：${stagingRel}（相对目标项目根；这是暂存位置，实例化语义上的最终归宿是 ${spec.targetRelPath}）`,
  ].join('\n')

  // Write(path) 规则不被文件权限检查匹配（官方文档明示，2.1.210 起告警）；
  // Edit(path) 才覆盖全部文件编辑工具（含 Write）
  const result = await ctx.claude({
    repoRoot: target,
    prompt,
    allowedTools: `Read,Glob,Grep,Edit(${stagingRel})`,
    onEvent,
  })

  if (result.timedOut) {
    return { ok: false, skipped: false, message: `${spec.targetRelPath}: claude instantiation timed out (rerun with --force to complete instantiation)${logHint}` }
  }
  if (result.code !== 0) {
    const stderrTail = result.stderr.trim().split('\n').slice(-3).join(' | ')
    return {
      ok: false,
      skipped: false,
      message: `${spec.targetRelPath}: claude exited with code ${result.code}${stderrTail === '' ? '' : ` (stderr: ${stderrTail})`} (rerun with --force to complete instantiation)${logHint}`,
    }
  }

  const content = readTextIfExists(stagingFile)
  if (content === null) {
    // claude 跑完却没产文件：若它给了结论文本，是明确拒绝（重试无用），带理由呈现；
    // 否则是真的没干活（崩溃/空跑），保留 --force 提示。
    const resultText = captured.resultText
    if (resultText !== null && resultText !== '') {
      const reason = resultText.length > 500 ? `${resultText.slice(0, 500)}…` : resultText
      return { ok: false, skipped: false, message: `${spec.targetRelPath}: claude declined to instantiate — ${reason}${logHint}` }
    }
    return { ok: false, skipped: false, message: `${spec.targetRelPath}: claude produced no file and gave no reason (rerun with --force to retry)${logHint}` }
  }
  if (PLACEHOLDER_PATTERN.test(content)) {
    return { ok: false, skipped: false, message: `${spec.targetRelPath}: leftover [ALL_CAPS] placeholder after instantiation (rerun with --force to complete instantiation)${logHint}` }
  }
  if (spec.name === 'claude-md') {
    const lineCount = content.split('\n').length
    if (lineCount >= 50) {
      return { ok: false, skipped: false, message: `${spec.targetRelPath}: ${lineCount} lines, must stay under 50 (rerun with --force to complete instantiation)${logHint}` }
    }
  }

  writeFileAtomic(targetFile, content)
  rmSync(stagingFile, { force: true })
  return { ok: true, skipped: false, message: `${spec.targetRelPath}: instantiated` }
}

interface InitPlan {
  source: Awaited<ReturnType<typeof resolveSource>>
  items: ReturnType<typeof planAssembly>['items']
  steps: ActionStep[]
  excluded: string[]
}

async function planInit(
  ctx: IuseContext,
  opts: { source?: string; profile: string; target: string; force: boolean; exclude?: string[]; rules?: string[] },
): Promise<{ ok: true; plan: InitPlan } | { ok: false; message: string }> {
  const existingLock = loadDownstreamLock(opts.target)
  if (existingLock !== null && !opts.force) {
    return fail(
      `${opts.target}: already initialized (profile '${existingLock.profile}'). Run 'iuse update' to refresh, or pass --force to reinitialize.`,
    )
  }

  if (opts.rules !== undefined && opts.exclude !== undefined && opts.exclude.length > 0) {
    return fail('--exclude is only valid with a profile, not with explicit --rules')
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
    return fail(error instanceof Error ? error.message : String(error))
  }

  let items: ReturnType<typeof planAssembly>['items']
  if (opts.rules !== undefined) {
    let assembled: ReturnType<typeof assembleRules>['items']
    let missing: ReturnType<typeof assembleRules>['missing']
    let violations: ReturnType<typeof assembleRules>['violations']
    try {
      ;({ items: assembled, missing, violations } = assembleRules(source.root, opts.rules))
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error))
    }
    if (missing.length > 0) {
      return fail(`unknown rules: ${missing.join(', ')}`)
    }
    if (violations.length > 0) {
      return fail(violations.join('\n'))
    }
    items = assembled
  } else {
    let violations: ReturnType<typeof planAssembly>['violations']
    try {
      ;({ items, violations } = planAssembly(source.root, opts.profile))
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error))
    }
    if (violations.length > 0) {
      return fail(`composition violations for profile '${opts.profile}':\n${violations.map((v) => `  - ${v}`).join('\n')}`)
    }
  }

  const excluded = [...new Set(opts.exclude ?? [])].toSorted()
  if (excluded.length > 0) {
    const profileRules = new Set(items.map((i) => i.rule))
    const unknown = excluded.filter((rule) => !profileRules.has(rule))
    if (unknown.length > 0) {
      return fail(`unknown rules in --exclude: ${unknown.join(', ')} (profile rules: ${[...profileRules].toSorted().join(', ')})`)
    }
  }
  const excludedSet = new Set(excluded)

  const steps: ActionStep[] = []

  for (const item of items) {
    if (excludedSet.has(item.rule)) {
      steps.push({ op: 'exclude-rule', target: item.rule, note: 'excluded' })
      continue
    }
    const targetPath = join(opts.target, item.targetRelPath)
    if (opts.force && existsSync(targetPath) && readFileSync(targetPath, 'utf8') === item.content) {
      steps.push({ op: 'copy-rule', target: item.targetRelPath, note: 'skipped: unchanged' })
      continue
    }
    steps.push({ op: 'copy-rule', target: item.targetRelPath })
  }

  const { artifactBase } = detectSourceRoot(source.root)
  const settingsSource = join(artifactBase, 'templates/settings.json')
  const settingsTarget = join(opts.target, '.claude/settings.json')
  const settingsRelPath = '.claude/settings.json'
  const settingsContent = readTextIfExists(settingsSource)
  if (settingsContent !== null) {
    if (existsSync(settingsTarget) && !opts.force) {
      steps.push({ op: 'copy-settings', target: settingsRelPath, note: 'skipped: already present' })
    } else {
      steps.push({ op: 'copy-settings', target: settingsRelPath })
    }
  }

  for (const spec of TEMPLATE_SPECS) {
    steps.push({ op: 'instantiate', target: spec.targetRelPath })
  }

  steps.push({ op: 'write-lock', target: LOCK_PATH })

  return { ok: true, plan: { source, items, steps, excluded } }
}

export async function runInit(
  ctx: IuseContext,
  opts: {
    source?: string
    profile: string
    target: string
    force: boolean
    dryRun?: boolean
    exclude?: string[]
    rules?: string[]
    onProgress?: (step: ActionStep) => void
  },
): Promise<{ ok: boolean; message: string; steps?: ActionStep[] }> {
  const planned = await planInit(ctx, opts)
  if (!planned.ok) return planned

  const { plan } = planned

  if (opts.dryRun === true) {
    return { ok: true, message: formatSteps(plan.steps), steps: plan.steps }
  }

  const { source, items, steps, excluded } = plan
  const { artifactBase } = detectSourceRoot(source.root)

  for (const step of steps) {
    if (step.op === 'exclude-rule') {
      opts.onProgress?.(step)
      continue
    }
    if (step.op === 'copy-rule') {
      opts.onProgress?.(step)
      if (step.note !== undefined) continue
      const item = items.find((i) => i.targetRelPath === step.target)
      if (item === undefined) continue
      writeFileAtomic(join(opts.target, item.targetRelPath), item.content)
    }
  }

  const notes: string[] = []
  const settingsStep = steps.find((s) => s.op === 'copy-settings')
  if (settingsStep !== undefined) {
    opts.onProgress?.(settingsStep)
    if (settingsStep.note !== undefined) {
      notes.push(`${settingsStep.target}: already present, skipped (use --force to overwrite)`)
    } else {
      const settingsContent = readTextIfExists(join(artifactBase, 'templates/settings.json'))
      if (settingsContent !== null) {
        writeFileAtomic(join(opts.target, settingsStep.target), settingsContent)
      }
    }
  }

  // 失败时保留 .iuse-staging（含 claude 事件日志）供排错——message 里的 log:
  // 路径才有效；只在全部实例化成功后清理，避免留暂存垃圾。
  for (const spec of TEMPLATE_SPECS) {
    const instantiateStep = steps.find((s) => s.op === 'instantiate' && s.target === spec.targetRelPath)
    if (instantiateStep !== undefined) {
      opts.onProgress?.(instantiateStep)
    }
    const result = await instantiateTemplate(ctx, artifactBase, opts.target, spec, opts.force)
    if (!result.ok) {
      ensureStagingIgnored(opts.target)
      return fail(result.message)
    }
    notes.push(result.message)
  }
  rmSync(join(opts.target, '.iuse-staging'), { recursive: true, force: true })

  const writeLockStep = steps.find((s) => s.op === 'write-lock')
  if (writeLockStep !== undefined) {
    opts.onProgress?.(writeLockStep)
  }

  const excludedSet = new Set(excluded)
  saveDownstreamLock(opts.target, {
    source: { type: source.version.type, id: source.version.id, locator: source.locator },
    profile: opts.profile,
    appliedAt: ctx.now(),
    rules: Object.fromEntries(items.filter((i) => !excludedSet.has(i.rule)).map((i) => [i.rule, i.hash])),
    templates: ['architecture', 'claude-md'],
    excluded,
  })

  const finalSteps: ActionStep[] = steps.map((s) => {
    if (s.op !== 'instantiate') return s
    const note = notes.find((n) => n.startsWith(`${s.target}:`))
    return note === undefined ? s : { ...s, note: note.slice(s.target.length + 2) }
  })

  // 落位从根 CLAUDE.md 迁到 .claude/CLAUDE.md 后，旧版本装下的根文件仍会被
  // Claude Code 加载（官方支持二者并存，内容叠加）。不代删（可能是用户手写），
  // 只提示，避免两份 CLAUDE.md 内容重复而无察觉。
  const legacyRootClaudeMd = join(opts.target, 'CLAUDE.md')
  const legacyNote =
    existsSync(legacyRootClaudeMd)
      ? ['注意：项目根仍有 CLAUDE.md；本次已落位到 .claude/CLAUDE.md，两者会同时加载，确认后可删除根文件']
      : []

  return {
    ok: true,
    message: [`initialized profile '${opts.profile}' from ${source.locator}`, ...notes, ...legacyNote].join('\n'),
    steps: finalSteps,
  }
}
