import { downstreamStates } from './dist'
import type { DownstreamState } from './dist'
import { discoverAssets } from './meta'
import type { MetaAsset } from './meta'
import { loadLock, loadTargets } from './registry'
import { computeStatus, gatherFacts } from './status'
import type { ReconcileStatus } from './status'

export interface OverviewRow {
  asset: MetaAsset
  status: ReconcileStatus
  downstream: { synced: number; drift: number; missing: number }
  targets: { path: string; state: DownstreamState }[]
}

export function loadOverview(repoRoot: string): OverviewRow[] {
  const lock = loadLock(repoRoot)
  const targets = loadTargets(repoRoot)
  return discoverAssets(repoRoot).map((asset) => {
    const states = asset.kind === 'rule' ? downstreamStates(repoRoot, asset, targets) : []
    return {
      asset,
      status: computeStatus(gatherFacts(repoRoot, asset, lock)),
      downstream: {
        synced: states.filter((s) => s.state === 'synced').length,
        drift: states.filter((s) => s.state === 'drift').length,
        missing: states.filter((s) => s.state === 'missing').length,
      },
      targets: states.map((s) => ({ path: s.target.path, state: s.state })),
    }
  })
}
