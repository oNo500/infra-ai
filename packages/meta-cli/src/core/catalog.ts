import { join } from 'node:path'
import { readTextIfExists } from './io'
import { loadProfiles, loadTagVocabulary } from './composition'
import type { TagVocabulary } from './composition'
import { discoverAssets } from './meta'

export interface CatalogRule {
  description: string
  tags: string[]
  scope: string
  path: string // 产物相对路径，如 rules/constitution.md
  profiles: string[] // 按名排序
}

export interface Catalog {
  generatedAt: string
  tags: TagVocabulary
  rules: Record<string, CatalogRule> // 键按名排序
}

export function buildCatalog(repoRoot: string, now: () => string): Catalog {
  const assets = discoverAssets(repoRoot).filter((a) => a.kind === 'rule' && a.status === 'ready')
  const profiles = loadProfiles(repoRoot)
  const memberOf = (rule: string): string[] =>
    Object.entries(profiles).filter(([, p]) => p.rules.includes(rule)).map(([name]) => name).toSorted()
  const rules: Record<string, CatalogRule> = {}
  for (const asset of [...assets].toSorted((a, b) => a.name.localeCompare(b.name))) {
    rules[asset.name] = {
      description: asset.description,
      tags: asset.tags,
      scope: asset.scope ?? 'global',
      path: asset.artifactPath,
      profiles: memberOf(asset.name),
    }
  }
  return { generatedAt: now(), tags: loadTagVocabulary(repoRoot), rules }
}

export function renderCatalog(catalog: Catalog): string {
  return `${JSON.stringify(catalog, null, 2)}\n`
}

export function loadCatalog(root: string): Catalog | null {
  const raw = readTextIfExists(join(root, 'catalog.json'))
  if (raw === null) return null
  try {
    return JSON.parse(raw) as Catalog
  } catch (error) {
    throw new Error(`catalog.json: invalid JSON (${String(error)})`, { cause: error })
  }
}

export function catalogStaleness(repoRoot: string): string | null {
  const existing = loadCatalog(repoRoot)
  if (existing === null) return "catalog.json missing (run 'imeta catalog')"
  const derived = buildCatalog(repoRoot, () => existing.generatedAt)
  return JSON.stringify(existing) === JSON.stringify(derived)
    ? null
    : "catalog.json stale (run 'imeta catalog')"
}
