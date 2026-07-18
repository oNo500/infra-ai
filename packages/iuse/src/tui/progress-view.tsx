import { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { Spinner } from '@inkjs/ui'
import type { ActionStep, IuseContext } from '../core/init'
import { runInit } from '../core/init'

export interface ProgressViewProps {
  ctx: IuseContext
  profile: string
  source: string | undefined
  target: string
  force: boolean
  steps: ActionStep[]
  onDone: (result: { ok: true; message: string }) => void
  onFail: (message: string) => void
}

/**
 * Runs the real (non-dry-run) init and ticks off the dry-run plan rows as
 * onProgress fires for each step. The in-flight 'instantiate' step (the one
 * onProgress most recently reported, still pending completion) gets a
 * spinner because claude instantiation is minute-scale and needs visible
 * liveness, unlike the near-instant file-copy steps around it.
 */
export function ProgressView({ ctx, profile, source, target, force, steps, onDone, onFail }: ProgressViewProps) {
  const [doneCount, setDoneCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    let ticked = 0
    runInit(ctx, {
      profile,
      source,
      target,
      force,
      onProgress: () => {
        ticked += 1
        if (!cancelled) setDoneCount(ticked)
      },
    }).then(
      (result) => {
        if (cancelled) return
        if (result.ok) {
          setDoneCount(steps.length)
          onDone({ ok: true, message: result.message })
        } else {
          onFail(result.message)
        }
      },
      (error) => {
        if (!cancelled) onFail(error instanceof Error ? error.message : String(error))
      },
    )
    return () => {
      cancelled = true
    }
    // props 是挂载时的固化快照；重跑靠 app.tsx 换 key 强制重挂载，不靠这个 effect 重跑。
  }, [])

  return (
    <Box flexDirection="column">
      <Text bold>执行中</Text>
      <Box flexDirection="column" marginTop={1}>
        {steps.map((step, i) => {
          const isDone = i < doneCount
          const isCurrent = i === doneCount
          const label = step.note === undefined ? `${step.op} ${step.target}` : `${step.op} ${step.target} (${step.note})`
          if (isCurrent && step.op === 'instantiate') {
            return <Spinner key={i} label={`${label} — claude 实例化中（分钟级）`} />
          }
          return (
            <Text key={i} dimColor={!isDone && !isCurrent}>
              {isDone ? '✓ ' : '  '}
              {label}
            </Text>
          )
        })}
      </Box>
    </Box>
  )
}
