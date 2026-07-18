import { join } from 'node:path'
import {
  discoverAssets, loadProfiles, loadTagVocabulary, readTextIfExists, sha256, validateComposition,
} from '@infra-ai/meta-cli/core'
import { ruleTargetRelPath } from './manifest'

export interface AssemblyItem {
  rule: string
  sourcePath: string
  targetRelPath: string
  content: string
  hash: string
}

export function assembleRules(
  sourceRoot: string,
  rules: string[],
): { items: AssemblyItem[]; missing: string[]; violations: string[] } {
  const assets = discoverAssets(sourceRoot)
  const byName = new Map(assets.filter((a) => a.kind === 'rule').map((a) => [a.name, a]))
  const items: AssemblyItem[] = []
  const missing: string[] = []
  const violations: string[] = []
  for (const rule of [...rules].toSorted()) {
    const asset = byName.get(rule)
    if (asset === undefined) {
      missing.push(rule)
      continue
    }
    const sourcePath = join(sourceRoot, asset.artifactPath)
    const content = readTextIfExists(sourcePath)
    if (content === null) {
      violations.push(`${rule}: built artifact missing at ${asset.artifactPath} (run imeta build in the source)`)
      continue
    }
    items.push({ rule, sourcePath, targetRelPath: ruleTargetRelPath(rule), content, hash: sha256(content) })
  }
  return { items, missing, violations }
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
  const compositionViolations = validateComposition(assets, loadTagVocabulary(sourceRoot), profiles)
  const { items, violations: assemblyViolations } = assembleRules(sourceRoot, profile.rules)
  return { items, violations: [...compositionViolations, ...assemblyViolations] }
}
