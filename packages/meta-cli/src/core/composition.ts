import { join } from 'node:path'
import { readTextIfExists } from './io'
import type { MetaAsset } from './meta'
import { RegistryError } from './registry'

export interface TagFacet {
  exclusive: boolean
  values: Record<string, string>
}

export type TagVocabulary = Record<string, TagFacet>

export interface Profile {
  description?: string
  rules: string[]
}

export type Profiles = Record<string, Profile>

function parseJson(repoRoot: string, filename: string): unknown {
  const raw = readTextIfExists(join(repoRoot, filename))
  if (raw === null) return null
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new RegistryError(`${filename}: invalid JSON (${String(error)})`)
  }
}

export function loadTagVocabulary(repoRoot: string): TagVocabulary {
  const raw = parseJson(repoRoot, 'meta/tags.json')
  if (raw === null) return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new RegistryError('meta/tags.json: must be an object of facet -> {exclusive, values}')
  }
  const seen = new Map<string, string>()
  for (const [facet, def] of Object.entries(raw)) {
    const d = def as { exclusive?: unknown; values?: unknown }
    if (typeof d.exclusive !== 'boolean' || typeof d.values !== 'object' || d.values === null || Array.isArray(d.values)) {
      throw new RegistryError(`meta/tags.json: facet '${facet}' must carry boolean exclusive and a values object`)
    }
    for (const [tag, desc] of Object.entries(d.values)) {
      if (typeof desc !== 'string') {
        throw new RegistryError(`meta/tags.json: tag '${tag}' description must be a string`)
      }
      if (seen.has(tag)) {
        throw new RegistryError(`meta/tags.json: tag '${tag}' appears in more than one facet`)
      }
      seen.set(tag, facet)
    }
  }
  return raw as TagVocabulary
}

export function facetOf(vocab: TagVocabulary, tag: string): string | null {
  for (const [facet, def] of Object.entries(vocab)) {
    if (tag in def.values) return facet
  }
  return null
}

export function loadProfiles(repoRoot: string): Profiles {
  const raw = parseJson(repoRoot, 'profiles.json')
  if (raw === null) return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new RegistryError('profiles.json: must be an object of name -> profile')
  }
  for (const [name, profile] of Object.entries(raw)) {
    const rules = (profile as { rules?: unknown }).rules
    if (!Array.isArray(rules) || rules.some((r) => typeof r !== 'string')) {
      throw new RegistryError(`profiles.json: profile '${name}' must carry a string[] rules field`)
    }
  }
  return raw as Profiles
}

export function validateComposition(
  assets: MetaAsset[],
  vocab: TagVocabulary,
  profiles: Profiles,
): string[] {
  const violations: string[] = []
  const rules = assets.filter((a) => a.kind === 'rule')
  const ruleNames = new Set(rules.map((r) => r.name))
  const usedTags = new Set<string>()
  for (const rule of rules) {
    if (rule.status === 'ready' && rule.tags.length === 0) {
      violations.push(`${rule.name}: ready rule must declare tags`)
    }
    const byFacet = new Map<string, string[]>()
    for (const tag of rule.tags) {
      usedTags.add(tag)
      const facet = facetOf(vocab, tag)
      if (facet === null) {
        violations.push(`${rule.name}: unknown tag '${tag}' (not in meta/tags.json)`)
        continue
      }
      byFacet.set(facet, [...(byFacet.get(facet) ?? []), tag])
    }
    for (const [facet, tags] of byFacet) {
      if (vocab[facet]?.exclusive === true && tags.length > 1) {
        violations.push(
          `${rule.name}: tags '${tags[0]}' and '${tags[1]}' are mutually exclusive within facet '${facet}'`,
        )
      }
    }
    for (const dep of rule.requires) {
      if (!ruleNames.has(dep)) violations.push(`${rule.name}: requires unknown rule '${dep}'`)
    }
  }
  for (const def of Object.values(vocab)) {
    for (const tag of Object.keys(def.values)) {
      if (!usedTags.has(tag)) violations.push(`orphan tag '${tag}' in meta/tags.json: no rule uses it`)
    }
  }
  const byName = new Map(rules.map((r) => [r.name, r]))
  for (const [name, profile] of Object.entries(profiles)) {
    for (const member of profile.rules) {
      const memberRule = byName.get(member)
      if (memberRule === undefined) {
        violations.push(`profile ${name}: unknown rule '${member}'`)
        continue
      }
      for (const dep of memberRule.requires) {
        if (!profile.rules.includes(dep)) {
          violations.push(`profile ${name}: '${member}' requires '${dep}' which is not in the profile`)
        }
      }
    }
    if (!profile.rules.includes('constitution')) {
      violations.push(`profile ${name}: missing constitution`)
    }
  }
  return violations
}
