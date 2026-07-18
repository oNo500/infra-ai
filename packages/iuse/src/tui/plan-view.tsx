import { Box, Text, useInput } from 'ink'
import type { ActionStep } from '../core/init'

export function PlanView({
  steps,
  onExecute,
  onBack,
  onQuit,
}: {
  steps: ActionStep[]
  onExecute: () => void
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
    if (key.return) onExecute()
  })

  return (
    <Box flexDirection="column">
      <Text bold>计划预览（dry-run）</Text>
      <Box flexDirection="column" marginTop={1}>
        {steps.map((step, i) => (
          <Text key={i}>
            {step.note === undefined ? `${step.op} ${step.target}` : `${step.op} ${step.target} (${step.note})`}
          </Text>
        ))}
        {steps.length === 0 && <Text dimColor>无步骤</Text>}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Enter 执行  Esc 返回选择  q 退出</Text>
      </Box>
    </Box>
  )
}
