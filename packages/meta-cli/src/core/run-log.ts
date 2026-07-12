import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import pino from 'pino'

export interface RunLog {
  path: string
  event: (step: string, data?: Record<string, unknown>) => void
  close: () => void
}

export const DEFAULT_RETAIN = 1000

function cleanup(dir: string, keep: number): void {
  try {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl'))
      .toSorted()
    for (const f of files.slice(0, Math.max(0, files.length - keep))) {
      rmSync(join(dir, f), { force: true })
    }
  } catch {
    // retention must never block the action
  }
}

export function createRunLog(
  repoRoot: string,
  actionId: string,
  params: { positionals: string[]; flags: Record<string, boolean> },
  now: string,
  retain = DEFAULT_RETAIN,
): RunLog {
  const dir = join(repoRoot, '.imeta', 'logs')
  mkdirSync(dir, { recursive: true })
  cleanup(dir, Math.max(0, retain - 1))
  const subject = params.positionals[0] ?? (params.flags.stale ? 'stale' : 'run')
  const safeSubject = subject.replaceAll(/[^A-Za-z0-9._-]/gu, '-').slice(0, 64)
  const stamp = now.replaceAll('-', '').replaceAll(':', '').replaceAll('.', '')
  const runId = `${stamp}-${actionId.replaceAll(':', '-')}-${safeSubject}`
  const path = join(dir, `${runId}.jsonl`)
  const destination = pino.destination({ dest: path, sync: true })
  const logger = pino(
    { base: { runId, action: actionId }, timestamp: pino.stdTimeFunctions.isoTime },
    destination,
  )
  let warned = false
  return {
    path,
    event(step, data = {}) {
      try {
        logger.info({ step, ...data })
      } catch (error) {
        if (!warned) {
          console.error(`run-log write failed: ${String(error)}`)
          warned = true
        }
      }
    },
    close() {
      try {
        destination.flushSync()
        destination.destroy()
      } catch {
        // sync destination may have nothing to flush
      }
    },
  }
}
