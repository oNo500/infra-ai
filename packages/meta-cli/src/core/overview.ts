import { discoverAssets } from './meta'
import type { MetaAsset } from './meta'
import { loadLock } from './registry'
import { computeStatus, gatherFacts } from './status'
import type { ReconcileStatus } from './status'

export interface OverviewRow {
  asset: MetaAsset
  status: ReconcileStatus
}

export function loadOverview(repoRoot: string): OverviewRow[] {
  const lock = loadLock(repoRoot)
  return discoverAssets(repoRoot).map((asset) => ({
    asset,
    status: computeStatus(gatherFacts(repoRoot, asset, lock)),
  }))
}
