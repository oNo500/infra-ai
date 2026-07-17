import { join } from 'node:path'
import {
  discoverAssets, loadProfiles, loadTagVocabulary, readTextIfExists, sha256, validateComposition,
} from '@infra-ai/meta-cli/core'

export interface AssemblyItem {
  rule: string
  sourcePath: string
  targetRelPath: string
  content: string
  hash: string
}

export function planAssembly(
  sourceRoot: string,
  profileName: string,
): { items: AssemblyItem[]; violations: string[] } {
  const profiles = loadProfiles(sourceRoot)
  const profile = profiles[profileName]
  if (profile === undefined) {
    throw new Error(`unknown profile '${profileName}' (available: ${Object.keys(profiles).toSorted().join(', ')})`)
  }
  const assets = discoverAssets(sourceRoot)
  const violations = validateComposition(assets, loadTagVocabulary(sourceRoot), profiles)
  const byName = new Map(assets.filter((a) => a.kind === 'rule').map((a) => [a.name, a]))
  const items: AssemblyItem[] = []
  for (const rule of [...profile.rules].toSorted()) {
    const asset = byName.get(rule)
    if (asset === undefined) continue // validateComposition 已计入 violations
    const sourcePath = join(sourceRoot, asset.artifactPath)
    const content = readTextIfExists(sourcePath)
    if (content === null) {
      violations.push(`${rule}: built artifact missing at ${asset.artifactPath} (run imeta build in the source)`)
      continue
    }
    items.push({ rule, sourcePath, targetRelPath: `.claude/rules/${rule}.md`, content, hash: sha256(content) })
  }
  return { items, violations }
}
