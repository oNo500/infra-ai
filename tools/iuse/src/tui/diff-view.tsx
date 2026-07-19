import { useEffect, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { IuseContext } from '../core/init'
import { diffReport } from '../core/diff'

const MAX_LINES = 200

type FetchState =
  | { kind: 'loading' }
  | { kind: 'patch'; patch: string }
  | { kind: 'error'; message: string }

function lineColor(line: string): string | undefined {
  if (line.startsWith('+')) return 'green'
  if (line.startsWith('-')) return 'red'
  if (line.startsWith('@@')) return 'cyan'
  return undefined
}

export function DiffView({
  ctx,
  target,
  source,
  rule,
  onAdjudicate,
  onBack,
}: {
  ctx: IuseContext
  target: string
  source: string | undefined
  rule: string
  onAdjudicate: (decision: 'overwrite' | 'ignore') => void
  onBack: () => void
}) {
  const [state, setState] = useState<FetchState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    diffReport(ctx, { source, target, rule }).then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setState({ kind: 'error', message: result.message ?? 'diff 获取失败' })
        return
      }
      const patch = result.diffs[0]?.patch
      setState(patch === undefined ? { kind: 'error', message: `${rule}: 没有可展示的差异` } : { kind: 'patch', patch })
    })
    return () => {
      cancelled = true
    }
    // ctx/target/source/rule 是挂载时的固化快照；每次进入 diff 视图都是新挂载（无需刷新键）。
  }, [])

  useInput((input, key) => {
    if (key.escape) {
      onBack()
      return
    }
    if (state.kind !== 'patch') return
    if (input === 'o') {
      onAdjudicate('overwrite')
      return
    }
    if (input === 'i') {
      onAdjudicate('ignore')
    }
  })

  if (state.kind === 'loading') {
    return <Text dimColor>加载差异中...</Text>
  }

  if (state.kind === 'error') {
    return (
      <Box flexDirection="column">
        <Text bold color="red">
          出错了
        </Text>
        <Text>{state.message}</Text>
        <Box marginTop={1}>
          <Text dimColor>esc 返回</Text>
        </Box>
      </Box>
    )
  }

  const lines = state.patch.split('\n')
  const truncated = lines.length > MAX_LINES
  const visible = truncated ? lines.slice(0, MAX_LINES) : lines

  return (
    <Box flexDirection="column">
      <Text bold>{rule} 差异</Text>
      <Box flexDirection="column" marginTop={1}>
        {visible.map((line, i) => (
          <Text key={i} color={lineColor(line)}>
            {line}
          </Text>
        ))}
        {truncated && <Text dimColor>已截断（完整差异：iuse diff --rule {rule}）</Text>}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>o 覆盖（源赢）  i 忽略（本次跳过）  esc 返回不裁决  q 退出</Text>
      </Box>
    </Box>
  )
}
