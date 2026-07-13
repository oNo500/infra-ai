import { join } from 'node:path'
import { loadOverview, readTextIfExists } from '@infra-ai/meta-cli/core'

export interface AssetSummary {
  name: string
  kind: string
  status: string
}

export interface AssetDetail extends AssetSummary {
  metaPath: string
  artifactPath: string
  meta: string
  artifact: string | null
}

export function assetsPayload(repoRoot: string): AssetSummary[] {
  return loadOverview(repoRoot).map((row) => ({
    name: row.asset.name,
    kind: row.asset.kind,
    status: row.status,
  }))
}

export function assetPayload(repoRoot: string, name: string): AssetDetail | null {
  const row = loadOverview(repoRoot).find((r) => r.asset.name === name)
  if (!row) return null
  return {
    name: row.asset.name,
    kind: row.asset.kind,
    status: row.status,
    metaPath: row.asset.metaPath,
    artifactPath: row.asset.artifactPath,
    meta: readTextIfExists(join(repoRoot, row.asset.metaPath)) ?? '',
    artifact: readTextIfExists(join(repoRoot, row.asset.artifactPath)),
  }
}
