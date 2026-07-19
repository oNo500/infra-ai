import { Box, Text, useInput } from 'ink'
import type { ProfileInfo } from '../core/profiles'

export function ProfilePicker({
  profiles,
  selected,
  onMove,
  onConfirm,
  onBack,
  onQuit,
}: {
  profiles: ProfileInfo[]
  selected: number
  onMove: (next: number) => void
  onConfirm: () => void
  onBack: () => void
  onQuit: () => void
}) {
  useInput((input, key) => {
    if (input === 'q') {
      onQuit()
      return
    }
    if (key.escape) {
      onBack()
      return
    }
    if (key.upArrow) onMove(Math.max(0, selected - 1))
    if (key.downArrow) onMove(Math.min(profiles.length - 1, selected + 1))
    if (key.return) onConfirm()
  })

  const current = profiles[selected]

  return (
    <Box flexDirection="column">
      <Text bold>选择 profile</Text>
      <Box marginTop={1}>
        <Box flexDirection="column" marginRight={4}>
          {profiles.map((profile, i) => (
            <Box key={profile.name} gap={1}>
              <Text inverse={i === selected}>{i === selected ? '>' : ' '}</Text>
              <Text bold={i === selected}>{profile.name}</Text>
              <Text dimColor>{profile.description}</Text>
            </Box>
          ))}
          {profiles.length === 0 && <Text dimColor>没有可用 profile</Text>}
        </Box>
        <Box flexDirection="column">
          <Text dimColor>rules:</Text>
          {current?.rules.map((rule) => <Text key={rule}>{rule}</Text>)}
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>上下 移动  Enter 确认  esc 返回主菜单  q 退出</Text>
      </Box>
    </Box>
  )
}
