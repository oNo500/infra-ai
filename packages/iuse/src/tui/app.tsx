import { useEffect, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import { join } from 'node:path'
import type { ActionStep, IuseContext } from '../core/init'
import { runInit } from '../core/init'
import { loadDownstreamLock } from '../core/manifest'
import { listProfiles } from '../core/profiles'
import type { ProfileInfo } from '../core/profiles'
import { resolveSource } from '../core/source'
import type { SourceRef } from '../core/source'
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

type View =
  | { kind: 'loading' }
  | { kind: 'profile-pick'; source: SourceRef; profiles: ProfileInfo[]; selected: number }
  | { kind: 'plan'; source: SourceRef; profile: string; steps: ActionStep[] }
  | { kind: 'running'; source: SourceRef; profile: string; steps: ActionStep[]; attempt: number }
  | { kind: 'result'; message: string; profile: string }
  | { kind: 'status'; profile: string; refreshKey: number }
  | { kind: 'update-plan'; profile: string }
  | {
      kind: 'error'
      message: string
      retry: 'source' | 'plan' | 'init'
      context?: { source: SourceRef; profile: string; steps: ActionStep[] }
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

  useEffect(() => {
    let cancelled = false

    const lock = loadDownstreamLock(deps.target)
    if (lock !== null) {
      if (!cancelled) setView({ kind: 'status', profile: lock.profile, refreshKey: 0 })
      return
    }

    resolveSourceRef(deps).then((resolved) => {
      if (cancelled) return
      if (!resolved.ok) {
        setView({ kind: 'error', message: resolved.message, retry: 'source' })
        return
      }
      const profiles = listProfiles(resolved.source.root)
      setView({ kind: 'profile-pick', source: resolved.source, profiles, selected: 0 })
    })

    return () => {
      cancelled = true
    }
  }, [deps])

  const retry = () => {
    if (view.kind !== 'error') return
    if (view.retry === 'source') {
      setView({ kind: 'loading' })
      resolveSourceRef(deps).then((resolved) => {
        if (!resolved.ok) {
          setView({ kind: 'error', message: resolved.message, retry: 'source' })
          return
        }
        const profiles = listProfiles(resolved.source.root)
        setView({ kind: 'profile-pick', source: resolved.source, profiles, selected: 0 })
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
    setView({ kind: 'running', source, profile, steps, attempt: 1 })
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
        setView({ kind: 'status', profile: view.profile, refreshKey: 0 })
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
        <TopBar target={deps.target} profile={view.profile} source={undefined} />
        <StatusView
          key={view.refreshKey}
          ctx={deps.ctx}
          target={deps.target}
          source={deps.source}
          onUpdate={() => setView({ kind: 'update-plan', profile: view.profile })}
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
          onExecute={() => setView({ kind: 'running', source: view.source, profile: view.profile, steps: view.steps, attempt: 0 })}
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
    return (
      <Box flexDirection="column">
        <TopBar target={deps.target} profile={view.profile} source={view.source} />
        <ProgressView
          key={view.attempt}
          steps={view.steps}
          run={(onProgress) =>
            runInit(deps.ctx, {
              profile: view.profile,
              source: deps.source,
              target: deps.target,
              force: view.attempt > 0,
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
          onDone={() => setView({ kind: 'status', profile: view.profile, refreshKey: Date.now() })}
          onBack={() => setView({ kind: 'status', profile: view.profile, refreshKey: 0 })}
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
  const instance = render(<App deps={deps} />)
  await instance.waitUntilExit()
}
