import { Box, Text, useInput } from 'ink'
import type { DownstreamState } from '../core/dist'
import type { OverviewRow } from '../core/overview'

export function AssetDetail({
  row,
  states,
  onExit,
}: {
  row: OverviewRow
  states: { path: string; state: DownstreamState }[]
  onExit: () => void
}) {
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
      <Box marginTop={1} flexDirection="column">
        <Text bold>下游副本</Text>
        {states.map(({ path, state }) => (
          <Text key={path}>
            {state.padEnd(8)} {path}
          </Text>
        ))}
        {states.length === 0 && <Text dimColor>无订阅方</Text>}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Enter/Esc 返回</Text>
      </Box>
    </Box>
  )
}
