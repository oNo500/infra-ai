import { useEffect, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { IuseContext } from '../core/init'
import type { StatusRow } from '../core/report'
import { statusReport } from '../core/report'
import { MessageBlock } from './message-block'

const STATE_COLOR: Record<StatusRow['state'], string> = {
  synced: 'green',
  modified: 'yellow',
  outdated: 'blue',
  missing: 'red',
}

type FetchState =
  | { kind: 'loading' }
  | { kind: 'rows'; rows: StatusRow[] }
  | { kind: 'error'; message: string }

export function StatusView({
  ctx,
  target,
  source,
  onUpdate,
  onQuit,
}: {
  ctx: IuseContext
  target: string
  source: string | undefined
  onUpdate: () => void
  onQuit: () => void
}) {
  const [state, setState] = useState<FetchState>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    statusReport(ctx, { source, target }).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setState({ kind: 'rows', rows: result.rows })
      } else {
        setState({ kind: 'error', message: result.message ?? 'status 获取失败' })
      }
    })
    return () => {
      cancelled = true
    }
    // ctx/target/source 是挂载时的固化快照；刷新靠 attempt 换值强制重跑本 effect。
  }, [attempt])

  useInput((input) => {
    if (input === 'q') {
      onQuit()
      return
    }
    if (input === 'r') {
      setAttempt((n) => n + 1)
      return
    }
    if (input === 'u' && state.kind === 'rows') {
      onUpdate()
    }
  })

  if (state.kind === 'loading') {
    return <Text dimColor>加载中...</Text>
  }

  if (state.kind === 'error') {
    return <MessageBlock title="出错了" message={state.message} tone="error" hint="r 重试  q 退出" />
  }

  return (
    <Box flexDirection="column">
      <Text bold>状态</Text>
      <Box flexDirection="column" marginTop={1}>
        {state.rows.map((row) => (
          <Text key={row.rule}>
            {row.rule} <Text color={STATE_COLOR[row.state]}>{row.state}</Text>
          </Text>
        ))}
        {state.rows.length === 0 && <Text dimColor>没有 rule 记录</Text>}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>u 进入 update  r 刷新  q 退出</Text>
      </Box>
    </Box>
  )
}
