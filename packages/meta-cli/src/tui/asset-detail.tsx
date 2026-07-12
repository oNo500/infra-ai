import { Box, Text, useInput } from 'ink'
import type { OverviewRow } from '../core/overview'

export function AssetDetail({ row, onExit }: { row: OverviewRow; onExit: () => void }) {
  useInput((_input, key) => {
    if (key.escape || key.return) onExit()
  })
  return (
    <Box flexDirection="column">
      <Text bold>
        {row.asset.name} ({row.asset.kind}) — {row.status}
      </Text>
      <Text>元指令  {row.asset.metaPath}</Text>
      <Text>产物    {row.asset.artifactPath}</Text>
      {row.asset.scope && <Text>范围    {row.asset.scope}</Text>}
      <Box marginTop={1}>
        <Text dimColor>Enter/Esc 返回</Text>
      </Box>
    </Box>
  )
}
