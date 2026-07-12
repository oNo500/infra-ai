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

export function AssetList({ rows, selected }: { rows: OverviewRow[]; selected: number }) {
  return (
    <Box flexDirection="column">
      {rows.map((row, i) => (
        <Box key={`${row.asset.kind}:${row.asset.name}`} gap={2}>
          <Text inverse={i === selected}>{i === selected ? '>' : ' '}</Text>
          <Text bold={i === selected}>{row.asset.name.padEnd(20)}</Text>
          <Text dimColor>{row.asset.kind.padEnd(8)}</Text>
          <Text color={STATUS_COLOR[row.status]}>{row.status.padEnd(10)}</Text>
        </Box>
      ))}
      {rows.length === 0 && <Text dimColor>meta/ 下没有资产</Text>}
    </Box>
  )
}
