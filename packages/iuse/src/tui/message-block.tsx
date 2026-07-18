import { Box, Text } from 'ink'

/**
 * Shared error/result block: title + multi-line message + keybinding hint line.
 * Used by both the error view (message-block with retry/quit) and the
 * result view (message-block with continue/quit) so the two terminal
 * states of the init flow share one visual shape.
 */
export function MessageBlock({
  title,
  message,
  tone,
  hint,
}: {
  title: string
  message: string
  tone: 'error' | 'success'
  hint: string
}) {
  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Text bold color={tone === 'error' ? 'red' : 'green'}>
        {title}
      </Text>
      {message.split('\n').map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
      <Box marginTop={1}>
        <Text dimColor>{hint}</Text>
      </Box>
    </Box>
  )
}
