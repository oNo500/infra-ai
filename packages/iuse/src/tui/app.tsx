import { useEffect, useState } from 'react'
import { Box, Text, useApp, useInput, useStdout } from 'ink'
import { join } from 'node:path'
import { loadCatalog, readTextIfExists } from '@infra-ai/meta-cli/core'
import type { TagVocabulary } from '@infra-ai/meta-cli/core'
import type { ActionStep, IuseContext } from '../core/init'
import { runInit } from '../core/init'
import type { ListRow } from '../core/list'
import { listReport } from '../core/list'
import { loadDownstreamLock } from '../core/manifest'
import { listProfiles } from '../core/profiles'
import type { ProfileInfo } from '../core/profiles'
import { resolveSource } from '../core/source'
import type { SourceRef } from '../core/source'
import { BrowseView } from './browse-view'
import { MessageBlock } from './message-block'
import { PlanView } from './plan-view'
import { ProfilePicker } from './profile-picker'
import { ProgressView } from './progress-view'
import { StatusView } from './status-view'
import { UpdatePlanView } from './update-plan-view'

export interface TuiDeps {
  ctx: IuseContext
  target: string
  source?: string
}

interface BrowseData {
  source: SourceRef
  rows: ListRow[]
  contentByName: Record<string, string>
  tags: TagVocabulary
}

type View =
  | { kind: 'loading' }
  | { kind: 'browse'; data: BrowseData; initialized: boolean; profile: string | undefined }
  | { kind: 'profile-pick'; source: SourceRef; profiles: ProfileInfo[]; selected: number }
  | { kind: 'plan'; source: SourceRef; profile: string; steps: ActionStep[] }
  | { kind: 'running'; source: SourceRef; profile: string; steps: ActionStep[]; attempt: number; exclude: string[] }
  | { kind: 'result'; message: string; profile: string }
  | { kind: 'status'; profile: string; refreshKey: number; source: SourceRef | undefined }
  | { kind: 'update-plan'; profile: string; initialAdd?: string[]; initialRemove?: string[] }
  | {
      kind: 'error'
      message: string
      retry: 'source' | 'plan' | 'init'
      context?: { source: SourceRef; profile: string; steps: ActionStep[] }
    }

/**
 * Assembles browse's left-column rows plus prefetched right-pane bodies for
 * every catalog rule in one pass -- browse never lazily re-fetches per
 * keystroke, so the whole content set is read up front at bootstrap.
 */
async function loadBrowseData(
  ctx: IuseContext,
  opts: { source?: string; target: string },
): Promise<{ ok: true; data: BrowseData } | { ok: false; message: string }> {
  const listed = await listReport(ctx, { source: opts.source, target: opts.target })
  if (!listed.ok) return { ok: false, message: listed.message ?? 'catalog 加载失败' }

  let source: SourceRef
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
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }

  const catalog = loadCatalog(source.root)
  if (catalog === null) {
    return { ok: false, message: `${source.root}: catalog.json missing, run 'imeta catalog' in the source` }
  }

  const contentByName: Record<string, string> = {}
  for (const row of listed.rows) {
    const rule = catalog.rules[row.name]
    if (rule === undefined) continue
    const content = readTextIfExists(join(source.root, rule.path))
    if (content !== null) contentByName[row.name] = content
  }

  return { ok: true, data: { source, rows: listed.rows, contentByName, tags: catalog.tags } }
}

async function resolveSourceRef(deps: TuiDeps): Promise<{ ok: true; source: SourceRef } | { ok: false; message: string }> {
  try {
    const source = await resolveSource({
      explicit: deps.source,
      envRoot: deps.ctx.env.INFRA_AI_ROOT,
      homeDefault: join(deps.ctx.home, 'code/infra-ai'),
      cacheDir: deps.ctx.cacheDir,
      download: deps.ctx.download,
      run: deps.ctx.run,
    })
    return { ok: true, source }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * app.tsx 拿到的 running 步骤是勾选前的原始 dry-run 计划：用户在 PlanView 里取消
 * 勾选后，真实执行会对这些 rule 各发一次 exclude-rule 事件（target 是 rule 名，
 * 见 core/init.ts planInit），而不是原计划里的 copy-rule 行（target 是
 * targetRelPath）。ProgressView 按 op+target 对号打勾，两者对不上号会让排除的
 * rule 行永远不亮、也吃不到真实事件。这里在渲染前按同样规则本地重写，让显示的
 * 行与即将触发的真实事件一一对应。
 */
function ruleFromCopyRuleTarget(targetRelPath: string): string {
  return targetRelPath.replace(/^\.claude\/rules\//u, '').replace(/\.md$/u, '')
}

function stepsForExecution(steps: ActionStep[], exclude: string[]): ActionStep[] {
  if (exclude.length === 0) return steps
  const excludedSet = new Set(exclude)
  return steps.map((step) => {
    if (step.op !== 'copy-rule') return step
    const rule = ruleFromCopyRuleTarget(step.target)
    if (!excludedSet.has(rule)) return step
    return { op: 'exclude-rule', target: rule, note: 'excluded' }
  })
}

/** Fallback terminal height when stdout.rows is unknown (e.g. ink-testing-library's fake stdout). */
const FALLBACK_ROWS = 24

const ALT_SCREEN_ENTER = '\x1b[?1049h'
const ALT_SCREEN_LEAVE = '\x1b[?1049l'

export interface AltScreenWritable {
  isTTY?: boolean
  write: (data: string) => void
}

/** Enters the alternate screen buffer -- a no-op outside a real TTY (e.g. ink-testing-library's fake stdout). */
export function enterAltScreen(stdout: AltScreenWritable): void {
  if (stdout.isTTY !== true) return
  stdout.write(ALT_SCREEN_ENTER)
}

/** Restores the primary screen buffer -- a no-op outside a real TTY. */
export function leaveAltScreen(stdout: AltScreenWritable): void {
  if (stdout.isTTY !== true) return
  stdout.write(ALT_SCREEN_LEAVE)
}

function TopBar({ target, profile, source }: { target: string; profile: string | undefined; source: SourceRef | undefined }) {
  const sourceText = source === undefined ? '-' : `${source.locator}@${source.version.id}`
  return (
    <Box marginBottom={1}>
      <Text dimColor>
        target {target}  profile {profile ?? '-'}  source {sourceText}
      </Text>
    </Box>
  )
}

export function App({ deps }: { deps: TuiDeps }) {
  const { exit } = useApp()
  const [view, setView] = useState<View>({ kind: 'loading' })
  const { stdout } = useStdout()
  const rows = stdout.rows ?? FALLBACK_ROWS

  useEffect(() => {
    let cancelled = false

    const lock = loadDownstreamLock(deps.target)
    if (lock !== null) {
      if (!cancelled) setView({ kind: 'status', profile: lock.profile, refreshKey: 0, source: undefined })
      return
    }

    loadBrowseData(deps.ctx, { source: deps.source, target: deps.target }).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setView({ kind: 'error', message: result.message, retry: 'source' })
        return
      }
      setView({ kind: 'browse', data: result.data, initialized: false, profile: undefined })
    })

    return () => {
      cancelled = true
    }
  }, [deps])

  // The status path (both the initial bootstrap and every return trip from
  // result/update-plan) enters with source left unresolved -- it only needs
  // the source for the TopBar locator, not for status's own data fetch. This
  // backfills it once per status view without blocking the status view
  // itself; a failure is swallowed and the TopBar keeps showing '-'. Keyed on
  // refreshKey (not the whole view object) so it fires once per distinct
  // status-view instance, not on every unrelated field change.
  const statusRefreshKey = view.kind === 'status' ? view.refreshKey : undefined
  useEffect(() => {
    if (view.kind !== 'status' || view.source !== undefined) return
    let cancelled = false
    resolveSourceRef(deps).then((resolved) => {
      if (cancelled || !resolved.ok) return
      setView((prev) => (prev.kind === 'status' ? { ...prev, source: resolved.source } : prev))
    })
    return () => {
      cancelled = true
    }
  }, [deps, statusRefreshKey])

  const retry = () => {
    if (view.kind !== 'error') return
    if (view.retry === 'source') {
      setView({ kind: 'loading' })
      loadBrowseData(deps.ctx, { source: deps.source, target: deps.target }).then((result) => {
        if (!result.ok) {
          setView({ kind: 'error', message: result.message, retry: 'source' })
          return
        }
        const lock = loadDownstreamLock(deps.target)
        setView({ kind: 'browse', data: result.data, initialized: lock !== null, profile: lock?.profile })
      })
      return
    }
    if (view.context === undefined) return
    const { source, profile, steps } = view.context
    if (view.retry === 'plan') {
      runInit(deps.ctx, { profile, source: deps.source, target: deps.target, force: false, dryRun: true }).then((result) => {
        if (result.ok && result.steps !== undefined) {
          setView({ kind: 'plan', source, profile, steps: result.steps })
        } else {
          setView({ kind: 'error', message: result.message, retry: 'plan', context: { source, profile, steps: [] } })
        }
      })
      return
    }
    // view.retry === 'init': force retry re-enters the running view with force applied
    setView({ kind: 'running', source, profile, steps, attempt: 1, exclude: [] })
  }

  useInput((input) => {
    if (view.kind === 'error') {
      if (input === 'q') exit()
      if (input === 'r') retry()
    }
    if (view.kind === 'result') {
      if (input === 'q') {
        exit()
      } else {
        setView({ kind: 'status', profile: view.profile, refreshKey: 0, source: undefined })
      }
    }
  })

  if (view.kind === 'loading') {
    return (
      <Box flexDirection="column">
        <TopBar target={deps.target} profile={undefined} source={undefined} />
        <Text dimColor>加载中...</Text>
      </Box>
    )
  }

  if (view.kind === 'status') {
    return (
      <Box flexDirection="column">
        <TopBar target={deps.target} profile={view.profile} source={view.source} />
        <StatusView
          key={view.refreshKey}
          ctx={deps.ctx}
          target={deps.target}
          source={deps.source}
          onUpdate={() => setView({ kind: 'update-plan', profile: view.profile })}
          onBrowse={() => {
            const profile = view.profile
            loadBrowseData(deps.ctx, { source: deps.source, target: deps.target }).then((result) => {
              if (!result.ok) {
                setView({ kind: 'error', message: result.message, retry: 'source' })
                return
              }
              setView({ kind: 'browse', data: result.data, initialized: true, profile })
            })
          }}
          onQuit={exit}
        />
      </Box>
    )
  }

  if (view.kind === 'browse') {
    return (
      <Box flexDirection="column" height={rows}>
        <TopBar target={deps.target} profile={view.profile} source={view.data.source} />
        <BrowseView
          rows={view.data.rows}
          terminalRows={rows}
          contentFor={(name) => view.data.contentByName[name] ?? ''}
          tags={view.data.tags}
          initialized={view.initialized}
          onInitRules={(rules) => {
            runInit(deps.ctx, { rules, profile: '-', source: deps.source, target: deps.target, force: false, dryRun: true }).then((result) => {
              if (result.ok && result.steps !== undefined) {
                setView({ kind: 'plan', source: view.data.source, profile: '-', steps: result.steps })
              } else {
                setView({
                  kind: 'error',
                  message: result.message,
                  retry: 'plan',
                  context: { source: view.data.source, profile: '-', steps: [] },
                })
              }
            })
          }}
          onAdd={(rule) => setView({ kind: 'update-plan', profile: view.profile ?? '-', initialAdd: [rule] })}
          onRemove={(rule) => setView({ kind: 'update-plan', profile: view.profile ?? '-', initialRemove: [rule] })}
          onPickProfile={() => {
            const profiles = listProfiles(view.data.source.root)
            setView({ kind: 'profile-pick', source: view.data.source, profiles, selected: 0 })
          }}
          onBack={() => {
            if (view.initialized) {
              setView({ kind: 'status', profile: view.profile ?? '-', refreshKey: 0, source: view.data.source })
              return
            }
            exit()
          }}
          onQuit={exit}
        />
      </Box>
    )
  }

  if (view.kind === 'profile-pick') {
    return (
      <Box flexDirection="column">
        <TopBar target={deps.target} profile={undefined} source={view.source} />
        <ProfilePicker
          profiles={view.profiles}
          selected={view.selected}
          onMove={(next) => setView({ ...view, selected: next })}
          onConfirm={() => {
            const profile = view.profiles[view.selected]
            if (profile === undefined) return
            runInit(deps.ctx, { profile: profile.name, source: deps.source, target: deps.target, force: false, dryRun: true })
              .then((result) => {
                if (result.ok && result.steps !== undefined) {
                  setView({ kind: 'plan', source: view.source, profile: profile.name, steps: result.steps })
                } else {
                  setView({
                    kind: 'error',
                    message: result.message,
                    retry: 'plan',
                    context: { source: view.source, profile: profile.name, steps: [] },
                  })
                }
              })
              .catch((error) => {
                setView({
                  kind: 'error',
                  message: error instanceof Error ? error.message : String(error),
                  retry: 'plan',
                  context: { source: view.source, profile: profile.name, steps: [] },
                })
              })
          }}
          onQuit={exit}
        />
      </Box>
    )
  }

  if (view.kind === 'plan') {
    return (
      <Box flexDirection="column">
        <TopBar target={deps.target} profile={view.profile} source={view.source} />
        <PlanView
          steps={view.steps}
          onExecute={(exclude) =>
            setView({ kind: 'running', source: view.source, profile: view.profile, steps: view.steps, attempt: 0, exclude })
          }
          onBack={() => {
            const profiles = listProfiles(view.source.root)
            const idx = profiles.findIndex((p) => p.name === view.profile)
            setView({ kind: 'profile-pick', source: view.source, profiles, selected: idx < 0 ? 0 : idx })
          }}
          onQuit={exit}
        />
      </Box>
    )
  }

  if (view.kind === 'running') {
    const executionSteps = stepsForExecution(view.steps, view.exclude)
    return (
      <Box flexDirection="column">
        <TopBar target={deps.target} profile={view.profile} source={view.source} />
        <ProgressView
          key={view.attempt}
          steps={executionSteps}
          run={(onProgress) =>
            runInit(deps.ctx, {
              profile: view.profile,
              source: deps.source,
              target: deps.target,
              force: view.attempt > 0,
              exclude: view.exclude,
              onProgress,
            })
          }
          onDone={(result) => setView({ kind: 'result', message: result.message, profile: view.profile })}
          onFail={(message) =>
            setView({
              kind: 'error',
              message,
              retry: 'init',
              context: { source: view.source, profile: view.profile, steps: view.steps },
            })
          }
        />
      </Box>
    )
  }

  if (view.kind === 'result') {
    return (
      <Box flexDirection="column">
        <TopBar target={deps.target} profile={view.profile} source={undefined} />
        <MessageBlock title="初始化完成" message={view.message} tone="success" hint="按任意键继续  q 退出" />
      </Box>
    )
  }

  if (view.kind === 'update-plan') {
    return (
      <Box flexDirection="column">
        <TopBar target={deps.target} profile={view.profile} source={undefined} />
        <UpdatePlanView
          ctx={deps.ctx}
          target={deps.target}
          source={deps.source}
          initialAdd={view.initialAdd}
          initialRemove={view.initialRemove}
          onDone={() => setView({ kind: 'status', profile: view.profile, refreshKey: Date.now(), source: undefined })}
          onBack={() => setView({ kind: 'status', profile: view.profile, refreshKey: 0, source: undefined })}
          onQuit={exit}
        />
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <TopBar target={deps.target} profile={view.context?.profile} source={view.context?.source} />
      <MessageBlock title="出错了" message={view.message} tone="error" hint="r 重试  q 退出" />
    </Box>
  )
}

export async function runTui(deps: TuiDeps): Promise<void> {
  const { render } = await import('ink')
  enterAltScreen(process.stdout)
  try {
    const instance = render(<App deps={deps} />)
    await instance.waitUntilExit()
  } finally {
    leaveAltScreen(process.stdout)
  }
}
