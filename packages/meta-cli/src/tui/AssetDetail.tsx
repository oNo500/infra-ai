import { Box, Text, useInput } from 'ink'
import type { DownstreamState } from '../core/dist'
import type { OverviewRow } from '../core/overview'
import type { Target } from '../core/registry'

export function AssetDetail({
  row,
  states,
  onExit,
}: {
  row: OverviewRow
  states: { target: Target; state: DownstreamState }[]
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
      <Text>meta:     {row.asset.metaPath}</Text>
      <Text>artifact: {row.asset.artifactPath}</Text>
      {row.asset.scope && <Text>scope:    {row.asset.scope}</Text>}
      <Box marginTop={1} flexDirection="column">
        <Text bold>downstream</Text>
        {states.map(({ target, state }) => (
          <Text key={target.path}>
            {state.padEnd(8)} {target.path}
          </Text>
        ))}
        {states.length === 0 && <Text dimColor>无订阅方</Text>}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Enter/Esc back</Text>
      </Box>
    </Box>
  )
}
