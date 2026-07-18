import { useMemo, useRef, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { TagVocabulary } from '@infra-ai/meta-cli/core'
import type { ListRow } from '../core/list'

const MAX_LINES = 200
const LEFT_WIDTH = 32

const STATE_COLOR: Record<Exclude<ListRow['state'], undefined | 'excluded'>, string> = {
  synced: 'green',
  modified: 'yellow',
  outdated: 'blue',
  missing: 'red',
  available: 'cyan',
  uninstalled: 'gray',
  broken: 'red',
}

export interface BrowseViewProps {
  rows: ListRow[]
  contentFor: (name: string) => string
  initialized: boolean
  onInitRules: (rules: string[]) => void
  onAdd: (rule: string) => void
  onRemove: (rule: string) => void
  onPickProfile: () => void
  onBack: () => void
  onQuit: () => void
  tags: TagVocabulary
}

/** 无过滤 -> 各 facet 依序 -> 回到无过滤，循环一圈。 */
function nextFacet(facets: string[], current: string | undefined): string | undefined {
  if (current === undefined) return facets[0]
  const idx = facets.indexOf(current)
  if (idx < 0 || idx === facets.length - 1) return undefined
  return facets[idx + 1]
}

function rowsForFacet(rows: ListRow[], tags: TagVocabulary, facet: string | undefined): ListRow[] {
  if (facet === undefined) return rows
  const facetTags = new Set(Object.keys(tags[facet]?.values ?? {}))
  return rows.filter((row) => row.tags.some((t) => facetTags.has(t)))
}

export function BrowseView({
  rows,
  contentFor,
  initialized,
  onInitRules,
  onAdd,
  onRemove,
  onPickProfile,
  onBack,
  onQuit,
  tags,
}: BrowseViewProps) {
  const facets = useMemo(() => Object.keys(tags).toSorted(), [tags])
  const [facet, setFacet] = useState<string | undefined>(undefined)
  const [cursor, setCursor] = useState(0)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  // useInput's handler closes over render-time state; two keystrokes landing in the
  // same tick (e.g. scripted test input) would otherwise read a stale cursor.
  const cursorRef = useRef(cursor)
  cursorRef.current = cursor

  const visibleRows = useMemo(() => rowsForFacet(rows, tags, facet), [rows, tags, facet])

  useInput((input, key) => {
    if (input === 'q') {
      onQuit()
      return
    }
    if (key.escape) {
      onBack()
      return
    }
    if (input === 'b') {
      onBack()
      return
    }
    if (input === 'p') {
      onPickProfile()
      return
    }
    if (key.upArrow) {
      setCursor((c) => {
        const next = Math.max(0, c - 1)
        cursorRef.current = next
        return next
      })
      return
    }
    if (key.downArrow) {
      setCursor((c) => {
        const next = Math.min(visibleRows.length - 1, c + 1)
        cursorRef.current = next
        return next
      })
      return
    }
    if (input === 't') {
      setFacet((f) => nextFacet(facets, f))
      setCursor(0)
      cursorRef.current = 0
      return
    }

    const row = visibleRows[cursorRef.current]

    if (!initialized) {
      if (input === ' ') {
        if (row === undefined) return
        setSelected((prev) => {
          const next = new Set(prev)
          if (next.has(row.name)) next.delete(row.name)
          else next.add(row.name)
          return next
        })
        return
      }
      if (key.return) {
        onInitRules([...selected].toSorted())
      }
      return
    }

    if (input === 'a') {
      if (row === undefined) return
      if (row.state !== 'available' && row.state !== 'uninstalled') return
      onAdd(row.name)
      return
    }
    if (input === 'x') {
      if (row === undefined) return
      const installedStates = new Set<ListRow['state']>(['synced', 'modified', 'outdated', 'missing'])
      if (!installedStates.has(row.state)) return
      onRemove(row.name)
    }
  })

  const currentRow = visibleRows[cursor]
  const body = currentRow === undefined ? '' : contentFor(currentRow.name)
  const bodyLines = body.split('\n')
  const truncated = bodyLines.length > MAX_LINES
  const visibleBodyLines = truncated ? bodyLines.slice(0, MAX_LINES) : bodyLines

  return (
    <Box flexDirection="column">
      <Text bold>浏览{facet === undefined ? '' : `（tag: ${facet}）`}</Text>
      <Box marginTop={1}>
        <Box flexDirection="column" width={LEFT_WIDTH} marginRight={2}>
          {visibleRows.map((row, i) => {
            const isSelected = selected.has(row.name)
            const checkbox = !initialized ? (isSelected ? '[x] ' : '[ ] ') : ''
            const stateText = row.state === undefined ? '' : row.state
            const color = row.state === undefined || row.state === 'excluded' ? undefined : STATE_COLOR[row.state]
            return (
              <Text key={row.name} inverse={i === cursor} dimColor={row.state === 'excluded'}>
                {i === cursor ? '> ' : '  '}
                {checkbox}
                {row.name}
                {stateText === '' ? '' : ' '}
                {color === undefined ? stateText : <Text color={color}>{stateText}</Text>}
              </Text>
            )
          })}
          {visibleRows.length === 0 && <Text dimColor>没有匹配的 rule</Text>}
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          {currentRow !== undefined && (
            <>
              <Text bold>{currentRow.name}</Text>
              <Text dimColor>{currentRow.description}</Text>
              <Text dimColor>tags: {currentRow.tags.join(', ')}</Text>
              <Box flexDirection="column" marginTop={1}>
                {currentRow.state === 'broken' ? (
                  <Text color="red">broken：源端产物缺失</Text>
                ) : (
                  visibleBodyLines.map((line, i) => <Text key={i}>{line}</Text>)
                )}
                {truncated && <Text dimColor>已截断（完整正文：iuse show {currentRow.name}）</Text>}
              </Box>
            </>
          )}
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {initialized
            ? '↑↓ 移动  t 切换 tag 过滤  a 添加  x 移除  p 选 profile  esc/b 返回状态  q 退出'
            : '↑↓ 移动  t 切换 tag 过滤  space 勾选  Enter 进入安装计划  p 选 profile  esc/b 退出  q 退出'}
        </Text>
      </Box>
    </Box>
  )
}
