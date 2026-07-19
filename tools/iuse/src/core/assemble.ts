import { join } from 'node:path'
import { loadCatalog, loadProfiles } from './contract'
import type { CatalogRule, Profile } from './contract'
import { readTextIfExists, sha256 } from './io'
import { ruleTargetRelPath } from './manifest'
import { renderRule } from './render'
import { detectSourceRoot } from './source-root'

export interface AssemblyItem {
  rule: string
  sourcePath: string
  targetRelPath: string
  content: string
  hash: string
}

function requireCatalogRules(sourceRoot: string): Record<string, CatalogRule> {
  const { catalogRoot } = detectSourceRoot(sourceRoot)
  const catalog = loadCatalog(catalogRoot)
  if (catalog === null) {
    throw new Error(`${sourceRoot}: catalog.json missing, run 'imeta catalog' in the source`)
  }
  return catalog.rules
}

export function assembleRules(
  sourceRoot: string,
  rules: string[],
): { items: AssemblyItem[]; missing: string[]; violations: string[] } {
  const catalogRules = requireCatalogRules(sourceRoot)
  const { artifactBase } = detectSourceRoot(sourceRoot)
  const items: AssemblyItem[] = []
  const missing: string[] = []
  const violations: string[] = []
  for (const rule of [...rules].toSorted()) {
    const entry = catalogRules[rule]
    if (entry === undefined) {
      missing.push(rule)
      continue
    }
    const sourcePath = join(artifactBase, entry.path)
    const content = readTextIfExists(sourcePath)
    if (content === null) {
      violations.push(`${rule}: built artifact missing at ${entry.path} (run imeta build in the source)`)
      continue
    }
    const rendered = renderRule(entry.scope, content)
    items.push({ rule, sourcePath, targetRelPath: ruleTargetRelPath(rule), content: rendered, hash: sha256(rendered) })
  }
  return { items, missing, violations }
}

/**
 * Catalog-driven composition check, scoped to a single profile -- a
 * downstream consumer only cares whether the one profile it is about to
 * install is internally consistent, not whether every other profile in
 * profiles.json is well-formed (that is imeta's / the source's job).
 */
function validateProfileComposition(
  profileName: string,
  profile: Profile,
  catalogRules: Record<string, CatalogRule>,
): string[] {
  const violations: string[] = []
  for (const member of profile.rules) {
    const entry = catalogRules[member]
    if (entry === undefined) {
      violations.push(`profile ${profileName}: unknown rule '${member}'`)
      continue
    }
    for (const dep of entry.requires) {
      if (!profile.rules.includes(dep)) {
        violations.push(`profile ${profileName}: '${member}' requires '${dep}' which is not in the profile`)
      }
    }
  }
  if (!profile.rules.includes('constitution')) {
    violations.push(`profile ${profileName}: missing constitution`)
  }
  return violations
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
  const catalogRules = requireCatalogRules(sourceRoot)
  const compositionViolations = validateProfileComposition(profileName, profile, catalogRules)
  const { items, violations: assemblyViolations } = assembleRules(sourceRoot, profile.rules)
  return { items, violations: [...compositionViolations, ...assemblyViolations] }
}
