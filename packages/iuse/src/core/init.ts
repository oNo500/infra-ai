import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { readTextIfExists, runClaude, writeFileAtomic } from '@infra-ai/meta-cli/core'
import type { CommandRunner } from '@infra-ai/meta-cli/core'
import { planAssembly } from './assemble'
import { LOCK_PATH, loadDownstreamLock, saveDownstreamLock } from './manifest'
import { resolveSource } from './source'

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
  { name: 'claude-md', sourceRelPath: 'templates/claude-md.md', targetRelPath: 'CLAUDE.md' },
]

const PLACEHOLDER_PATTERN = /\[[A-Z][A-Z0-9_]*\]/u

export interface ActionStep {
  op: string
  target: string
  note?: string
}

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message }
}

function formatSteps(steps: ActionStep[]): string {
  return steps.map((s) => (s.note === undefined ? `${s.op} ${s.target}` : `${s.op} ${s.target} (${s.note})`)).join('\n')
}

async function instantiateTemplate(
  ctx: IuseContext,
  sourceRoot: string,
  target: string,
  spec: TemplateSpec,
  force: boolean,
): Promise<{ ok: boolean; message: string; skipped: boolean }> {
  const targetFile = join(target, spec.targetRelPath)
  // 校验是写入时门禁，不是常驻不变量——跳过的既有产物不重新校验（--force 重建才再次过校验）。
  if (existsSync(targetFile) && !force) {
    return { ok: true, skipped: true, message: `${spec.targetRelPath}: already present, skipped (use --force to re-instantiate)` }
  }

  const contractPath = join(sourceRoot, 'meta/prompts/template-instantiate.md')
  const templatePath = join(sourceRoot, spec.sourceRelPath)
  // CLAUDE.md 与 .claude/** 是权限系统的敏感文件，headless 下 allowedTools
  // 无法放行直写——claude 只写非敏感的 staging 文件，落位由本进程完成
  const stagingRel = `.iuse-staging/${spec.name}.md`
  const stagingFile = join(target, stagingRel)
  mkdirSync(join(target, '.iuse-staging'), { recursive: true })
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
  })

  if (result.timedOut) {
    return { ok: false, skipped: false, message: `${spec.targetRelPath}: claude instantiation timed out (rerun with --force to complete instantiation)` }
  }
  if (result.code !== 0) {
    const stderrTail = result.stderr.trim().split('\n').slice(-3).join(' | ')
    return {
      ok: false,
      skipped: false,
      message: `${spec.targetRelPath}: claude exited with code ${result.code}${stderrTail === '' ? '' : ` (stderr: ${stderrTail})`} (rerun with --force to complete instantiation)`,
    }
  }

  const content = readTextIfExists(stagingFile)
  if (content === null) {
    return { ok: false, skipped: false, message: `${spec.targetRelPath}: claude did not produce the file (rerun with --force to complete instantiation)` }
  }
  if (PLACEHOLDER_PATTERN.test(content)) {
    return { ok: false, skipped: false, message: `${spec.targetRelPath}: leftover [ALL_CAPS] placeholder after instantiation (rerun with --force to complete instantiation)` }
  }
  if (spec.name === 'claude-md') {
    const lineCount = content.split('\n').length
    if (lineCount >= 50) {
      return { ok: false, skipped: false, message: `${spec.targetRelPath}: ${lineCount} lines, must stay under 50 (rerun with --force to complete instantiation)` }
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
}

async function planInit(
  ctx: IuseContext,
  opts: { source?: string; profile: string; target: string; force: boolean },
): Promise<{ ok: true; plan: InitPlan } | { ok: false; message: string }> {
  const existingLock = loadDownstreamLock(opts.target)
  if (existingLock !== null && !opts.force) {
    return fail(
      `${opts.target}: already initialized (profile '${existingLock.profile}'). Run 'iuse update' to refresh, or pass --force to reinitialize.`,
    )
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
  let violations: ReturnType<typeof planAssembly>['violations']
  try {
    ;({ items, violations } = planAssembly(source.root, opts.profile))
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
  if (violations.length > 0) {
    return fail(`composition violations for profile '${opts.profile}':\n${violations.map((v) => `  - ${v}`).join('\n')}`)
  }

  const steps: ActionStep[] = []

  for (const item of items) {
    const targetPath = join(opts.target, item.targetRelPath)
    if (opts.force && existsSync(targetPath) && readFileSync(targetPath, 'utf8') === item.content) {
      steps.push({ op: 'copy-rule', target: item.targetRelPath, note: 'skipped: unchanged' })
      continue
    }
    steps.push({ op: 'copy-rule', target: item.targetRelPath })
  }

  const settingsSource = join(source.root, 'templates/settings.json')
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

  return { ok: true, plan: { source, items, steps } }
}

export async function runInit(
  ctx: IuseContext,
  opts: { source?: string; profile: string; target: string; force: boolean; dryRun?: boolean; onProgress?: (step: ActionStep) => void },
): Promise<{ ok: boolean; message: string; steps?: ActionStep[] }> {
  const planned = await planInit(ctx, opts)
  if (!planned.ok) return planned

  const { plan } = planned

  if (opts.dryRun === true) {
    return { ok: true, message: formatSteps(plan.steps), steps: plan.steps }
  }

  const { source, items, steps } = plan

  for (const step of steps) {
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
      const settingsContent = readTextIfExists(join(source.root, 'templates/settings.json'))
      if (settingsContent !== null) {
        writeFileAtomic(join(opts.target, settingsStep.target), settingsContent)
      }
    }
  }

  try {
    for (const spec of TEMPLATE_SPECS) {
      const instantiateStep = steps.find((s) => s.op === 'instantiate' && s.target === spec.targetRelPath)
      if (instantiateStep !== undefined) {
        opts.onProgress?.(instantiateStep)
      }
      const result = await instantiateTemplate(ctx, source.root, opts.target, spec, opts.force)
      if (!result.ok) return fail(result.message)
      notes.push(result.message)
    }
  } finally {
    rmSync(join(opts.target, '.iuse-staging'), { recursive: true, force: true })
  }

  const writeLockStep = steps.find((s) => s.op === 'write-lock')
  if (writeLockStep !== undefined) {
    opts.onProgress?.(writeLockStep)
  }

  saveDownstreamLock(opts.target, {
    source: { type: source.version.type, id: source.version.id, locator: source.locator },
    profile: opts.profile,
    appliedAt: ctx.now(),
    rules: Object.fromEntries(items.map((i) => [i.rule, i.hash])),
    templates: ['architecture', 'claude-md'],
  })

  const finalSteps: ActionStep[] = steps.map((s) => {
    if (s.op !== 'instantiate') return s
    const note = notes.find((n) => n.startsWith(`${s.target}:`))
    return note === undefined ? s : { ...s, note: note.slice(s.target.length + 2) }
  })

  return {
    ok: true,
    message: [`initialized profile '${opts.profile}' from ${source.locator}`, ...notes].join('\n'),
    steps: finalSteps,
  }
}
