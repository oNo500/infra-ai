import { join } from 'node:path'
import { readTextIfExists, writeFileAtomic } from './io'
import type { MetaAsset } from './meta'
import type { Target } from './registry'

export type DownstreamState = 'missing' | 'drift' | 'synced'

export function downstreamPath(targetPath: string, assetName: string): string {
  return join(targetPath, '.claude', 'rules', `${assetName}.md`)
}

export function computeDownstreamState(
  artifact: string,
  downstream: string | null,
): DownstreamState {
  if (downstream === null) return 'missing'
  return downstream === artifact ? 'synced' : 'drift'
}

export function subscribers(targets: Target[], assetName: string): Target[] {
  return targets.filter((t) => t.subscriptions.includes(assetName))
}

export function distribute(repoRoot: string, asset: MetaAsset, target: Target): void {
  if (asset.kind !== 'rule') {
    throw new Error(`only rule assets are distributable, got ${asset.kind}: ${asset.name}`)
  }
  const artifact = readTextIfExists(join(repoRoot, asset.artifactPath))
  if (artifact === null) {
    throw new Error(`artifact missing: ${asset.artifactPath}`)
  }
  writeFileAtomic(downstreamPath(target.path, asset.name), artifact)
}

export function downstreamStates(
  repoRoot: string,
  asset: MetaAsset,
  targets: Target[],
): { target: Target; state: DownstreamState }[] {
  const artifact = readTextIfExists(join(repoRoot, asset.artifactPath))
  return subscribers(targets, asset.name).map((target) => ({
    target,
    state:
      artifact === null
        ? 'missing'
        : computeDownstreamState(artifact, readTextIfExists(downstreamPath(target.path, asset.name))),
  }))
}
