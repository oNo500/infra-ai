import { join } from 'node:path'
import { readTextIfExists, writeFileAtomic } from '@infra-ai/meta-cli/core'

export const LOCK_PATH = '.claude/infra-ai.lock.json'

export interface DownstreamLock {
  source: { type: 'local' | 'remote'; id: string; locator: string }
  profile: string
  appliedAt: string
  rules: Record<string, string>
  templates: string[]
}

export function loadDownstreamLock(targetRoot: string): DownstreamLock | null {
  const raw = readTextIfExists(join(targetRoot, LOCK_PATH))
  if (raw === null) return null
  try {
    return JSON.parse(raw) as DownstreamLock
  } catch (error) {
    throw new Error(`${LOCK_PATH}: invalid JSON (${String(error)})`)
  }
}

export function saveDownstreamLock(targetRoot: string, lock: DownstreamLock): void {
  writeFileAtomic(join(targetRoot, LOCK_PATH), `${JSON.stringify(lock, null, 2)}\n`)
}

export type DriftState = 'synced' | 'modified' | 'outdated' | 'missing'

export function computeDrift(
  localHash: string | null,
  baselineHash: string,
  sourceHash: string | null,
): DriftState {
  if (localHash === null) return 'missing'
  if (localHash !== baselineHash) return 'modified'
  if (sourceHash === null || sourceHash !== baselineHash) return 'outdated'
  return 'synced'
}
