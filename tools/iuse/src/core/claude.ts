import { spawn } from 'node:child_process'

function parseStreamJsonLine(
  line: string,
): { type: string; text: string | null; raw: unknown } | null {
  const trimmed = line.trim()
  if (trimmed === '') return null
  let raw: unknown
  try {
    raw = JSON.parse(trimmed)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null || typeof (raw as { type?: unknown }).type !== 'string') {
    return null
  }
  const event = raw as { type: string; message?: { content?: unknown }; result?: unknown }
  if (event.type === 'assistant' && Array.isArray(event.message?.content)) {
    const text = event.message.content
      .filter(
        (b): b is { type: string; text: string } =>
          typeof b === 'object' && b !== null && (b as { type?: unknown }).type === 'text',
      )
      .map((b) => b.text)
      .join('')
    return { type: 'assistant', text: text === '' ? null : text, raw }
  }
  if (event.type === 'result') {
    return { type: 'result', text: typeof event.result === 'string' ? event.result : null, raw }
  }
  return { type: event.type, text: null, raw }
}

export interface RunResult {
  code: number
  timedOut: boolean
  stderr: string
}

export function runClaude(opts: {
  repoRoot: string
  prompt: string
  allowedTools: string
  timeoutMs?: number
  onText?: (t: string) => void
  onEvent?: (raw: unknown) => void
}): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(
      'claude',
      [
        '-p',
        opts.prompt,
        '--output-format',
        'stream-json',
        '--verbose',
        '--allowedTools',
        opts.allowedTools,
      ],
      { cwd: opts.repoRoot, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let stderr = ''
    let buffer = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, opts.timeoutMs ?? 300_000)
    child.stdout.on('data', (d: Buffer) => {
      buffer += d.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const event = parseStreamJsonLine(line)
        if (event) {
          opts.onEvent?.(event.raw)
          if (event.text) opts.onText?.(event.text)
        }
      }
    })
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString()
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (buffer !== '') {
        const event = parseStreamJsonLine(buffer)
        if (event) {
          opts.onEvent?.(event.raw)
          if (event.text) opts.onText?.(event.text)
        }
      }
      resolve({ code: code ?? -1, timedOut, stderr })
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ code: -1, timedOut, stderr: String(err) })
    })
  })
}
