import { useCallback, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import { loadOverview, type OverviewRow } from '../core/overview'
import { AssetList } from './AssetList'

export function App({ repoRoot }: { repoRoot: string }) {
  const { exit } = useApp()
  const [rows, setRows] = useState<OverviewRow[]>(() => loadOverview(repoRoot))
  const [selected, setSelected] = useState(0)

  const reload = useCallback(() => {
    setRows(loadOverview(repoRoot))
    setSelected((s) => Math.min(s, Math.max(0, loadOverview(repoRoot).length - 1)))
  }, [repoRoot])

  useInput((input, key) => {
    if (input === 'q') exit()
    if (input === 'r') reload()
    if (key.upArrow) setSelected((s) => Math.max(0, s - 1))
    if (key.downArrow) setSelected((s) => Math.min(rows.length - 1, s + 1))
  })

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>infra-ai meta</Text>
      <Box marginTop={1}>
        <AssetList rows={rows} selected={selected} />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>up/down move  r reload  q quit</Text>
      </Box>
    </Box>
  )
}
