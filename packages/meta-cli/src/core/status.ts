import { join } from 'node:path'
import { readTextIfExists, sha256 } from './io'
import type { MetaAsset, MetaStatus } from './meta'
import type { Lock, LockEntry } from './registry'

export type ReconcileStatus = 'stub' | 'unbuilt' | 'untracked' | 'dirty' | 'stale' | 'synced'

export interface AssetFacts {
  metaStatus: MetaStatus
  metaHash: string
  artifactHash: string | null
  lock: LockEntry | null
}

export function computeStatus(f: AssetFacts): ReconcileStatus {
  if (f.metaStatus === 'stub') return 'stub'
  if (f.artifactHash === null) return 'unbuilt'
  if (f.lock === null) return 'untracked'
  if (f.artifactHash !== f.lock.artifactHash) return 'dirty'
  if (f.metaHash !== f.lock.metaHash) return 'stale'
  return 'synced'
}

export function lockKey(asset: MetaAsset): string {
  return `${asset.kind}:${asset.name}`
}

export function gatherFacts(repoRoot: string, asset: MetaAsset, lock: Lock): AssetFacts {
  const metaContent = readTextIfExists(join(repoRoot, asset.metaPath)) ?? ''
  const artifactContent = readTextIfExists(join(repoRoot, asset.artifactPath))
  return {
    metaStatus: asset.status,
    metaHash: sha256(metaContent),
    artifactHash: artifactContent === null ? null : sha256(artifactContent),
    lock: lock[lockKey(asset)] ?? null,
  }
}

export function adoptEntry(metaHash: string, artifactHash: string, builtAt: string): LockEntry {
  return { metaHash, artifactHash, builtAt }
}
