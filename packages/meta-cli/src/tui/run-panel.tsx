import { Box, Text } from 'ink'

export interface Job {
  title: string
  lines: string[]
  done: boolean
  error: string | null
}

export function RunPanel({ job }: { job: Job }) {
  const tail = job.lines.slice(-15)
  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Text bold>
        {job.title} {job.done ? (job.error ? '[失败]' : '[完成]') : '[运行中]'}
      </Text>
      {tail.map((line, i) => (
        <Text key={i} wrap="truncate-end" dimColor>
          {line}
        </Text>
      ))}
      {job.error && <Text color="red">{job.error}</Text>}
    </Box>
  )
}
