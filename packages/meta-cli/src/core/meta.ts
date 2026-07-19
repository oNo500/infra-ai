import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import matter from 'gray-matter'
import { KINDS, KIND_ORDER } from './kinds'
import type { AssetKind } from './kinds'
import { sha256 } from './io'

export type { AssetKind } from './kinds'
export type MetaStatus = 'stub' | 'ready'

export interface MetaAsset {
  name: string
  kind: AssetKind
  status: MetaStatus
  scope: string | null
  tags: string[]
  requires: string[]
  metaPath: string
  artifactPath: string
  description: string
  refUrl: string
}

export function artifactPathFor(kind: AssetKind, name: string, scope: string | null): string {
  return KINDS[kind].artifactPath(name, scope)
}

const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/u

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

export function parseMetaFile(content: string, filename: string, kind: AssetKind): MetaAsset {
  const { data } = matter(content)
  const stem = filename.replace(/\.md$/u, '')
  const frontmatterName = typeof data.name === 'string' ? data.name : null
  const name = frontmatterName !== null && NAME_PATTERN.test(frontmatterName) ? frontmatterName : stem
  if (!NAME_PATTERN.test(name)) {
    throw new Error(`${filename}: invalid asset name '${name}'`)
  }
  const status: MetaStatus = data.status === 'ready' ? 'ready' : 'stub'
  const scope = kind === 'rule' && typeof data.scope === 'string' ? data.scope : null
  return {
    name,
    kind,
    status,
    scope,
    tags: stringArray(data.tags),
    requires: stringArray(data.requires),
    metaPath: `${KINDS[kind].metaDir}/${filename}`,
    artifactPath: artifactPathFor(kind, name, scope),
    description: typeof data.description === 'string' ? data.description.trim() : '',
    refUrl: typeof data.refUrl === 'string' ? data.refUrl.trim() : '',
  }
}

export function metaContentHash(content: string): string {
  const { data, content: body } = matter(content)
  const kept = {
    name: typeof data.name === 'string' ? data.name : null,
    status: data.status === 'ready' ? 'ready' : 'stub',
    scope: typeof data.scope === 'string' ? data.scope : null,
  }
  return sha256(`${JSON.stringify(kept)}\n${body}`)
}

export function discoverAssets(repoRoot: string): MetaAsset[] {
  const assets: MetaAsset[] = []
  const seen = new Map<string, string>()
  for (const kind of KIND_ORDER) {
    const dir = join(repoRoot, KINDS[kind].metaDir)
    if (!existsSync(dir)) continue
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .toSorted()
    for (const f of files) {
      const asset = parseMetaFile(readFileSync(join(dir, f), 'utf8'), f, kind)
      const key = `${asset.kind}:${asset.name}`
      const prior = seen.get(key)
      if (prior !== undefined) {
        throw new Error(`duplicate asset name '${asset.name}' in ${prior} and ${asset.metaPath}`)
      }
      seen.set(key, asset.metaPath)
      assets.push(asset)
    }
  }
  return assets
}
