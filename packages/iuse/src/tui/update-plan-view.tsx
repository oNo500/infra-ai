import { useEffect, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { ActionStep, IuseContext } from '../core/init'
import { runUpdate } from '../core/update'
import { MessageBlock } from './message-block'
import { ProgressView } from './progress-view'

type PlanState =
  | { kind: 'loading' }
  | { kind: 'plan'; steps: ActionStep[] }
  | { kind: 'plan-error'; message: string }
  | { kind: 'running'; steps: ActionStep[]; attempt: number }
  | { kind: 'run-error'; message: string }

function formatStep(step: ActionStep): string {
  const base = step.note === undefined ? `${step.op} ${step.target}` : `${step.op} ${step.target} (${step.note})`
  return step.op === 'skip-modified' ? `${base}  默认跳过` : base
}

export function UpdatePlanView({
  ctx,
  target,
  source,
  onDone,
  onBack,
  onQuit,
}: {
  ctx: IuseContext
  target: string
  source: string | undefined
  onDone: () => void
  onBack: () => void
  onQuit: () => void
}) {
  const [force, setForce] = useState(false)
  const [state, setState] = useState<PlanState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    runUpdate(ctx, { source, target, force, dryRun: true }).then((result) => {
      if (cancelled) return
      if (result.ok && result.steps !== undefined) {
        setState({ kind: 'plan', steps: result.steps })
      } else {
        setState({ kind: 'plan-error', message: result.message })
      }
    })
    return () => {
      cancelled = true
    }
    // ctx/target/source 是挂载时的固化快照；force 变化触发重取 dry-run 计划。
  }, [force])

  useInput((input, key) => {
    if (input === 'q') {
      onQuit()
      return
    }
    if (state.kind === 'plan' || state.kind === 'plan-error') {
      if (input === 'f') {
        setForce((f) => !f)
        return
      }
      if (key.escape) {
        onBack()
        return
      }
    }
    if (state.kind === 'plan') {
      if (key.return) {
        setState((prev) => ({ kind: 'running', steps: prev.kind === 'plan' ? prev.steps : [], attempt: 0 }))
      }
      return
    }
    if (state.kind === 'run-error') {
      if (input === 'r') {
        setState({ kind: 'running', steps: [], attempt: 0 })
      } else if (key.escape) {
        onBack()
      }
    }
  })

  if (state.kind === 'loading') {
    return <Text dimColor>加载 update 计划中...</Text>
  }

  if (state.kind === 'running') {
    return (
      <ProgressView
        key={state.attempt}
        steps={state.steps}
        run={(onProgress) => runUpdate(ctx, { source, target, force, onProgress })}
        onDone={() => onDone()}
        onFail={(message) => setState({ kind: 'run-error', message })}
      />
    )
  }

  if (state.kind === 'run-error') {
    return <MessageBlock title="出错了" message={state.message} tone="error" hint="r 重试  esc 返回" />
  }

  if (state.kind === 'plan-error') {
    return (
      <Box flexDirection="column">
        <MessageBlock title="出错了" message={state.message} tone="error" hint="esc 返回" />
        <Box marginTop={1}>
          <Text dimColor>f 切换 force（当前 {force ? '开' : '关'}）</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text bold>update 计划预览（dry-run）</Text>
      {force && (
        <Box marginTop={1}>
          <Text color="yellow" bold>
            force 已开启：modified/missing 项将被覆盖
          </Text>
        </Box>
      )}
      <Box flexDirection="column" marginTop={1}>
        {state.steps.map((step, i) => (
          <Text key={i}>{formatStep(step)}</Text>
        ))}
        {state.steps.length === 0 && <Text dimColor>无步骤</Text>}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Enter 执行  f 切换 force  esc 返回 Status  q 退出</Text>
      </Box>
    </Box>
  )
}
