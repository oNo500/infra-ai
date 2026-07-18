import { join } from 'node:path'
import { readTextIfExists, sha256, writeFileAtomic } from '@infra-ai/meta-cli/core'

export const LOCK_PATH = '.claude/infra-ai.lock.json'

export function ruleTargetRelPath(rule: string): string {
  return `.claude/rules/${rule}.md`
}

export function localHashFor(target: string, rule: string): string | null {
  const content = readTextIfExists(join(target, ruleTargetRelPath(rule)))
  return content === null ? null : sha256(content)
}

export interface DownstreamLock {
  source: { type: 'local' | 'remote'; id: string; locator: string }
  profile: string
  appliedAt: string
  rules: Record<string, string>
  templates: string[]
  excluded?: string[]
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
  // excluded 账保持精简：字段仅在非空时写出（旧账/无排除目标不出现该 key）
  const { excluded, ...rest } = lock
  const serializable: DownstreamLock = excluded !== undefined && excluded.length > 0 ? { ...rest, excluded } : rest
  writeFileAtomic(join(targetRoot, LOCK_PATH), `${JSON.stringify(serializable, null, 2)}\n`)
}

export type DriftState = 'synced' | 'modified' | 'outdated' | 'missing' | 'excluded'

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
