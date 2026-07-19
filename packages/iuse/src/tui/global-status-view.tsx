import { useEffect, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { GlobalRow } from '../core/global'
import { globalStatusReport } from '../core/global'
import type { IuseContext } from '../core/init'
import { MessageBlock } from './message-block'

const STATE_COLOR: Record<GlobalRow['state'], string> = {
  synced: 'green',
  differs: 'yellow',
  missing: 'red',
  unmanaged: 'gray',
}

type FetchState =
  | { kind: 'loading' }
  | { kind: 'rows'; rows: GlobalRow[]; duplicates: string[] }
  | { kind: 'error'; message: string }

export function GlobalStatusView({
  ctx,
  source,
  target,
  onBack,
  onQuit,
}: {
  ctx: IuseContext
  source: string | undefined
  target: string
  onBack: () => void
  onQuit: () => void
}) {
  const [state, setState] = useState<FetchState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    globalStatusReport(ctx, { source, projectTarget: target }).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setState({ kind: 'rows', rows: result.rows, duplicates: result.duplicates })
      } else {
        setState({ kind: 'error', message: result.message ?? '全局对账失败' })
      }
    })
    return () => {
      cancelled = true
    }
  }, [ctx, source, target])

  useInput((input, key) => {
    if (input === 'q') {
      onQuit()
      return
    }
    if (key.escape) {
      onBack()
    }
  })

  if (state.kind === 'loading') {
    return <Text dimColor>加载中...</Text>
  }

  if (state.kind === 'error') {
    return <MessageBlock title="出错了" message={state.message} tone="error" hint="esc 返回" />
  }

  return (
    <Box flexDirection="column">
      <Text bold>全局对账</Text>
      <Box flexDirection="column" marginTop={1}>
        {state.rows.map((row) => (
          <Box key={row.rule} flexDirection="column">
            <Text>
              {row.rule} <Text color={STATE_COLOR[row.state]}>{row.state}</Text>
            </Text>
            {row.suggestion !== undefined && <Text dimColor>{row.suggestion}</Text>}
          </Box>
        ))}
        {state.rows.length === 0 && <Text dimColor>没有全局 rule 记录</Text>}
      </Box>
      {state.duplicates.length > 0 && (
        <Box marginTop={1}>
          <Text color="yellow">双层重复（全局与项目都装了，Claude 会加载两遍）: {state.duplicates.join(', ')}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>esc 返回  q 退出</Text>
      </Box>
    </Box>
  )
}
