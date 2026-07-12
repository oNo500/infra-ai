import { Box, Text } from 'ink'
import type { OverviewRow } from '../core/overview'
import type { ReconcileStatus } from '../core/status'

const STATUS_COLOR: Record<ReconcileStatus, string> = {
  stub: 'gray',
  unbuilt: 'cyan',
  untracked: 'magenta',
  dirty: 'red',
  stale: 'yellow',
  synced: 'green',
}

function downstreamSummary(row: OverviewRow): string {
  if (row.asset.kind !== 'rule') return ''
  const d = row.downstream
  const total = d.synced + d.drift + d.missing
  if (total === 0) return '无订阅'
  const parts: string[] = []
  if (d.synced > 0) parts.push(`${d.synced} 已同步`)
  if (d.drift > 0) parts.push(`${d.drift} 漂移`)
  if (d.missing > 0) parts.push(`${d.missing} 缺失`)
  return parts.join('，')
}

export function AssetList({ rows, selected }: { rows: OverviewRow[]; selected: number }) {
  return (
    <Box flexDirection="column">
      {rows.map((row, i) => (
        <Box key={`${row.asset.kind}:${row.asset.name}`} gap={2}>
          <Text inverse={i === selected}>{i === selected ? '>' : ' '}</Text>
          <Text bold={i === selected}>{row.asset.name.padEnd(20)}</Text>
          <Text dimColor>{row.asset.kind.padEnd(8)}</Text>
          <Text color={STATUS_COLOR[row.status]}>{row.status.padEnd(10)}</Text>
          <Text dimColor>{downstreamSummary(row)}</Text>
        </Box>
      ))}
      {rows.length === 0 && <Text dimColor>meta/ 下没有资产</Text>}
    </Box>
  )
}
