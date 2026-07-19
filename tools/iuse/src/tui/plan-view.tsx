import { useRef, useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { ActionStep } from '../core/init'

/** copy-rule 步骤的 target 是 targetRelPath（.claude/rules/<rule>.md），还原出 rule 名供勾选集使用。 */
function ruleFromTarget(target: string): string {
  return target.replace(/^\.claude\/rules\//u, '').replace(/\.md$/u, '')
}

export function PlanView({
  steps,
  onExecute,
  onBack,
  onQuit,
}: {
  steps: ActionStep[]
  onExecute: (excluded: string[]) => void
  onBack: () => void
  onQuit: () => void
}) {
  const [cursor, setCursor] = useState(0)
  const [uncheckedRules, setUncheckedRules] = useState<ReadonlySet<string>>(new Set())
  // useInput's handler closes over render-time state; two keystrokes landing in the
  // same tick (e.g. scripted test input, or a fast typist) would otherwise read a
  // stale cursor. A ref mirrors the latest value synchronously across such calls.
  const cursorRef = useRef(cursor)
  cursorRef.current = cursor

  useInput((input, key) => {
    if (input === 'q') {
      onQuit()
      return
    }
    if (key.escape) {
      onBack()
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
        const next = Math.min(steps.length - 1, c + 1)
        cursorRef.current = next
        return next
      })
      return
    }
    if (input === ' ') {
      const step = steps[cursorRef.current]
      if (step === undefined || step.op !== 'copy-rule') return
      const rule = ruleFromTarget(step.target)
      setUncheckedRules((prev) => {
        const next = new Set(prev)
        if (next.has(rule)) next.delete(rule)
        else next.add(rule)
        return next
      })
      return
    }
    if (key.return) onExecute([...uncheckedRules].toSorted())
  })

  return (
    <Box flexDirection="column">
      <Text bold>计划预览（dry-run）</Text>
      <Box flexDirection="column" marginTop={1}>
        {steps.map((step, i) => {
          const isRuleRow = step.op === 'copy-rule'
          const rule = isRuleRow ? ruleFromTarget(step.target) : undefined
          const checkbox = isRuleRow ? (rule !== undefined && uncheckedRules.has(rule) ? '[ ] ' : '[x] ') : ''
          const label = step.note === undefined ? `${step.op} ${step.target}` : `${step.op} ${step.target} (${step.note})`
          return (
            <Text key={i} inverse={i === cursor}>
              {checkbox}
              {label}
            </Text>
          )
        })}
        {steps.length === 0 && <Text dimColor>无步骤</Text>}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>↑↓ 移动  space 切换排除（仅 copy-rule 行）  Enter 执行  Esc 返回选择  q 退出</Text>
      </Box>
    </Box>
  )
}
