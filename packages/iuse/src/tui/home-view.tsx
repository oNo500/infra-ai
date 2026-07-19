import { useState } from 'react'
import { Box, Text, useInput } from 'ink'

export type HomeMenuItemId = 'init-profile' | 'browse' | 'global-status' | 'status' | 'update'

export interface HomeMenuItem {
  id: HomeMenuItemId
  label: string
  hint: string
}

/**
 * Menu shape for a target with no downstream lock yet: profile-driven init,
 * self-picked rules via browse, or a read-only look at the global (~/.claude)
 * reconciliation. Cursor defaults to the first item -- the most likely next
 * step for a project nobody has assembled yet.
 */
const UNINITIALIZED_ITEMS: HomeMenuItem[] = [
  { id: 'init-profile', label: '初始化(选 profile)', hint: '用预设组合拼装本项目' },
  { id: 'browse', label: '初始化(自选 rules) / 浏览资产', hint: '左右分屏浏览中心源，勾选后拼装' },
  { id: 'global-status', label: '全局对账', hint: '~/.claude 与中心源的只读对账' },
]

/**
 * Menu shape once a downstream lock exists: status is the default landing
 * spot (cursor 0) since checking drift is the most likely next step for an
 * already-assembled project.
 */
const INITIALIZED_ITEMS: HomeMenuItem[] = [
  { id: 'status', label: '状态对账', hint: '逐 rule 漂移状态' },
  { id: 'update', label: '更新', hint: '应用中心源变更' },
  { id: 'browse', label: '浏览资产', hint: '现有 browse，a/x 增减仍可用' },
  { id: 'global-status', label: '全局对账', hint: '~/.claude 与中心源的只读对账' },
]

export function homeMenuItems(initialized: boolean): HomeMenuItem[] {
  return initialized ? INITIALIZED_ITEMS : UNINITIALIZED_ITEMS
}

export function HomeView({
  initialized,
  onSelect,
  onQuit,
}: {
  initialized: boolean
  onSelect: (id: HomeMenuItemId) => void
  onQuit: () => void
}) {
  const items = homeMenuItems(initialized)
  const [cursor, setCursor] = useState(0)

  useInput((input, key) => {
    if (input === 'q') {
      onQuit()
      return
    }
    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1))
      return
    }
    if (key.downArrow) {
      setCursor((c) => Math.min(items.length - 1, c + 1))
      return
    }
    if (key.return) {
      const item = items[cursor]
      if (item !== undefined) onSelect(item.id)
    }
  })

  return (
    <Box flexDirection="column">
      <Text bold>iuse</Text>
      <Box flexDirection="column" marginTop={1}>
        {items.map((item, i) => (
          <Box key={item.id} flexDirection="column">
            <Text inverse={i === cursor}>
              {i === cursor ? '> ' : '  '}
              {item.label}
            </Text>
            <Text dimColor>{'    '}{item.hint}</Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>上下 移动  Enter 进入  q 退出</Text>
      </Box>
    </Box>
  )
}
