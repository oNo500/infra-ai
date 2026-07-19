import { join } from 'node:path'
import { readTextIfExists } from './io'
import { discoverAssets } from './meta'

export interface Globals {
  rules: string[]
}

export function loadGlobals(root: string): Globals | null {
  const raw = readTextIfExists(join(root, 'globals.json'))
  if (raw === null) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`globals.json: invalid JSON (${String(error)})`, { cause: error })
  }
  const rules = (parsed as { rules?: unknown }).rules
  if (!Array.isArray(rules) || rules.some((r) => typeof r !== 'string')) {
    throw new Error('globals.json: expected { "rules": string[] }')
  }
  return { rules: rules as string[] }
}

export function globalsViolations(repoRoot: string): string[] {
  let globals: Globals | null
  try {
    globals = loadGlobals(repoRoot)
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)]
  }
  if (globals === null) return []
  const byName = new Map(
    discoverAssets(repoRoot).filter((a) => a.kind === 'rule').map((a) => [a.name, a]),
  )
  const violations: string[] = []
  for (const name of globals.rules) {
    const asset = byName.get(name)
    if (asset === undefined) {
      violations.push(`globals.json: unknown rule '${name}'`)
      continue
    }
    if (asset.status !== 'ready') violations.push(`globals.json: rule '${name}' is not ready`)
  }
  return violations
}
