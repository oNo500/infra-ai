import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { ScrollView } from 'ink-scroll-view'
import type { ScrollViewRef } from 'ink-scroll-view'
import type { TagVocabulary } from '@infra-ai/meta-cli/core'
import type { ListRow } from '../core/list'

const LEFT_WIDTH = 32
// Rows the browse view spends on chrome around the two-column body: the title
// line, the margin above the body, and the margin+text of the help line.
const CHROME_ROWS = 4
// Right-pane header rows above the scrollable body: name, description, tags,
// plus the blank margin line before the body starts.
const PREVIEW_HEADER_ROWS = 4
// Bottom-of-pane row reserved for the scroll position indicator.
const POSITION_INDICATOR_ROWS = 1

const STATE_COLOR: Record<Exclude<ListRow['state'], undefined | 'excluded'>, string> = {
  synced: 'green',
  modified: 'yellow',
  outdated: 'blue',
  differs: 'blue',
  missing: 'red',
  available: 'cyan',
  uninstalled: 'gray',
  broken: 'red',
}

export interface BrowseViewProps {
  rows: ListRow[]
  terminalRows: number
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

export interface ListWindow {
  start: number
  end: number // exclusive
  hasMoreAbove: boolean
  hasMoreBelow: boolean
}

/**
 * Slices [start, end) around the cursor so the left list never exceeds
 * `maxRows` total rows -- row rows plus one "..." indicator row reserved for
 * each side, always reserved once windowing kicks in (so the layout is
 * stable rather than reflowing by 1 row as the cursor nears an edge).
 * Centers the cursor when there's slack on both sides; clamps to the array
 * bounds otherwise so the window always uses its full row budget.
 *
 * When maxRows <= 2 (tiny terminal), degrades to showing just the cursor line
 * and as many adjacent lines as budget allows, without "..." indicators.
 */
export function listWindow(length: number, cursor: number, maxRows: number): ListWindow {
  if (length <= maxRows) return { start: 0, end: length, hasMoreAbove: false, hasMoreBelow: false }

  // Guard against tiny terminals: when budget would be 0 or negative, just show
  // cursor line and up to (maxRows - 1) adjacent lines.
  if (maxRows <= 2) {
    const start = Math.max(0, Math.min(cursor, length - maxRows))
    const end = Math.min(length, start + maxRows)
    return { start, end, hasMoreAbove: start > 0, hasMoreBelow: end < length }
  }

  const budget = maxRows - 2
  let start = cursor - Math.floor(budget / 2)
  if (start < 0) start = 0
  const maxStart = Math.max(0, length - budget)
  if (start > maxStart) start = maxStart
  const end = Math.min(length, start + budget)

  return { start, end, hasMoreAbove: start > 0, hasMoreBelow: end < length }
}

export function BrowseView({
  rows,
  terminalRows,
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

  const scrollRef = useRef<ScrollViewRef>(null)
  const [scrollOffset, setScrollOffset] = useState(0)

  const visibleRows = useMemo(() => rowsForFacet(rows, tags, facet), [rows, tags, facet])

  const bodyAreaHeight = Math.max(1, terminalRows - CHROME_ROWS)
  const previewBodyHeight = Math.max(1, bodyAreaHeight - PREVIEW_HEADER_ROWS - POSITION_INDICATOR_ROWS)

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
    if (input === 'j') {
      scrollRef.current?.scrollBy(1)
      return
    }
    if (input === 'k') {
      scrollRef.current?.scrollBy(-1)
      return
    }
    if (input === 'g') {
      scrollRef.current?.scrollToTop()
      return
    }
    if (input === 'G') {
      scrollRef.current?.scrollToBottom()
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

  // ScrollView remounts (key={currentRow.name}) on row change and its own
  // scroll offset resets to 0, but onScroll only fires on a scroll -- without
  // this, our locally tracked scrollOffset would keep the previous row's
  // value and the position indicator would show a stale range for a beat.
  useEffect(() => {
    setScrollOffset(0)
  }, [currentRow?.name])

  const listSlice = listWindow(visibleRows.length, cursor, bodyAreaHeight)
  const windowedRows = visibleRows.slice(listSlice.start, listSlice.end)

  const viewportHeight = scrollRef.current?.getViewportHeight() ?? previewBodyHeight
  const positionStart = Math.min(bodyLines.length, scrollOffset + 1)
  const positionEnd = Math.min(bodyLines.length, scrollOffset + viewportHeight)

  return (
    <Box flexDirection="column">
      <Text bold>浏览{facet === undefined ? '' : `（tag: ${facet}）`}</Text>
      <Box marginTop={1} height={bodyAreaHeight}>
        <Box flexDirection="column" width={LEFT_WIDTH} marginRight={2}>
          {listSlice.hasMoreAbove && <Text dimColor>...</Text>}
          {windowedRows.map((row, offset) => {
            const i = listSlice.start + offset
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
          {listSlice.hasMoreBelow && <Text dimColor>...</Text>}
          {visibleRows.length === 0 && <Text dimColor>没有匹配的 rule</Text>}
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          {currentRow !== undefined && (
            <>
              <Text bold>{currentRow.name}</Text>
              <Text dimColor>{currentRow.description}</Text>
              <Text dimColor>tags: {currentRow.tags.join(', ')}</Text>
              {currentRow.state === 'broken' ? (
                <Box flexDirection="column" marginTop={1}>
                  <Text color="red">broken：源端产物缺失</Text>
                </Box>
              ) : (
                <Box flexDirection="column" marginTop={1} height={previewBodyHeight}>
                  <ScrollView key={currentRow.name} ref={scrollRef} onScroll={setScrollOffset}>
                    {bodyLines.map((line, i) => (
                      <Text key={i}>{line}</Text>
                    ))}
                  </ScrollView>
                </Box>
              )}
              {currentRow.state !== 'broken' && (
                <Text dimColor>
                  {positionStart}-{positionEnd}/{bodyLines.length}
                </Text>
              )}
            </>
          )}
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {initialized
            ? '↑↓ 移动  t 切换 tag 过滤  a 添加  x 移除  p 选 profile  j/k 滚动预览  g/G 顶/底  esc/b 返回状态  q 退出'
            : '↑↓ 移动  t 切换 tag 过滤  space 勾选  Enter 进入安装计划  p 选 profile  j/k 滚动预览  g/G 顶/底  esc/b 退出  q 退出'}
        </Text>
      </Box>
    </Box>
  )
}
